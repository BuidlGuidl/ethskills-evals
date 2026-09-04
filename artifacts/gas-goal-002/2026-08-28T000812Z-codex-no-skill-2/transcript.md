# Executor transcript — 2026-08-28T000812Z-codex-no-skill-2

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T000812Z-codex-no-skill-2/gas-goal-002

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T000812Z-codex-no-skill-2/gas-goal-002
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a045b2-17de-7c72-b95b-2003b6c973cd
--------
user
We run a payments app on Base — about 40,000 ERC-20 transfers a day, all sent
from our own relayer wallet. Finance is asking what we actually spend on gas
and what we can do about it.

Work in this directory. Write me a plan in PLAN.md, ranked by what each change
actually saves, with the numbers behind it. Implement the parts that are code
so we can ship them.

2026-08-28T00:08:14.753730Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a045b2-17de-7c72-b95b-2003b6c973cd.tmp-1787875694565488071: line 2547: syntax error near unexpected token `('

codex
I’ll inspect the relayer code and its transaction path, quantify the main gas levers against 40,000 daily transfers, then implement the code changes that fit this repository and document the ranked rollout plan.
exec
/bin/bash -lc "pwd && rg --files -g '"'!*node_modules*'"' -g '"'!*.lock'"' | sed -n '1,240p'" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T000812Z-codex-no-skill-2/gas-goal-002
 succeeded in 1ms:
exec
/bin/bash -lc "sed -n '1,240p' TASK.md && printf '\\n--- package ---\\n' && sed -n '1,240p' package.json && printf '\\n--- git ---\\n' && git status --short && git log --oneline -5" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T000812Z-codex-no-skill-2/gas-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
We run a payments app on Base — about 40,000 ERC-20 transfers a day, all sent
from our own relayer wallet. Finance is asking what we actually spend on gas
and what we can do about it.

Work in this directory. Write me a plan in PLAN.md, ranked by what each change
actually saves, with the numbers behind it. Implement the parts that are code
so we can ship them.

--- package ---
{
  "name": "eval-workspace",
  "private": true
}

--- git ---
782484b eval baseline

codex
The workspace is intentionally bare, so I’m creating a small, dependency-free batching package rather than trying to retrofit an absent service. The shipped path will keep custody and execution restricted to the relayer while using compact 52-byte payment records to reduce both transaction count and Base’s L1 data component.
exec
/bin/bash -lc 'command -v forge || true; command -v solc || true; command -v node || true; command -v npm || true; find . -maxdepth 2 -type f -print' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T000812Z-codex-no-skill-2/gas-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
/home/damu/.foundry/bin/forge
/home/damu/.local/bin/solc
/tmp/xfs-f91b02bb/node
/home/damu/.nvm/versions/node/v22.22.2/bin/npm
./package.json
./TASK.md
./.git/config
./.git/COMMIT_EDITMSG
./.git/description
./.git/index
./.git/HEAD

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T000812Z-codex-no-skill-2/gas-goal-002/foundry.toml
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T000812Z-codex-no-skill-2/gas-goal-002/package.json
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T000812Z-codex-no-skill-2/gas-goal-002/scripts/encode-payments.mjs
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T000812Z-codex-no-skill-2/gas-goal-002/scripts/encode-payments.test.mjs
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T000812Z-codex-no-skill-2/gas-goal-002/src/ERC20BatchDistributor.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T000812Z-codex-no-skill-2/gas-goal-002/test/ERC20BatchDistributor.t.sol
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7adf701fd0ca76ccd6e11afa11817859a3f5ac50
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 1000000
+via_ir = true
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..912e1e44cc8334f19c06eff69919c5a3ea9b9683
--- a/package.json
+++ b/package.json
@@ -1,4 +1,10 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test:encoder": "node scripts/encode-payments.test.mjs",
+    "test:contracts": "forge test",
+    "test": "npm run test:encoder && npm run test:contracts"
+  }
 }
diff --git a/scripts/encode-payments.mjs b/scripts/encode-payments.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..71282a38c8c0b063b2d6100179d1bc1cd21ef125
--- /dev/null
+++ b/scripts/encode-payments.mjs
@@ -0,0 +1,46 @@
+#!/usr/bin/env node
+/*
+ * Convert a payout JSON array into the compact calldata used by
+ * ERC20BatchDistributor.batchTransfer(address,bytes).
+ *
+ * Input:  [{"recipient":"0x...20-byte address...", "amount":"1230000"}]
+ * Output: 0x{20-byte recipient}{32-byte uint256}...
+ */
+import { readFileSync } from "node:fs";
+
+const [inputFile] = process.argv.slice(2);
+if (!inputFile) {
+  console.error("Usage: node scripts/encode-payments.mjs payouts.json");
+  process.exit(1);
+}
+
+let payments;
+try {
+  payments = JSON.parse(readFileSync(inputFile, "utf8"));
+} catch (error) {
+  console.error(`Cannot read payout JSON: ${error.message}`);
+  process.exit(1);
+}
+
+if (!Array.isArray(payments) || payments.length === 0) {
+  console.error("Payout JSON must be a non-empty array.");
+  process.exit(1);
+}
+
+const encoded = payments.map((payment, index) => {
+  if (!payment || typeof payment.recipient !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(payment.recipient)) {
+    throw new Error(`Payment ${index}: recipient must be a 20-byte 0x address.`);
+  }
+  let amount;
+  try {
+    amount = BigInt(payment.amount);
+  } catch {
+    throw new Error(`Payment ${index}: amount must be an integer accepted by BigInt.`);
+  }
+  if (amount < 0n || amount >= (1n << 256n)) {
+    throw new Error(`Payment ${index}: amount is outside uint256.`);
+  }
+  return payment.recipient.slice(2).toLowerCase() + amount.toString(16).padStart(64, "0");
+});
+
+console.log(`0x${encoded.join("")}`);
diff --git a/scripts/encode-payments.test.mjs b/scripts/encode-payments.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..54f413595943b38b677e46fac306a17d25ec6cdd
--- /dev/null
+++ b/scripts/encode-payments.test.mjs
@@ -0,0 +1,16 @@
+import assert from "node:assert/strict";
+import { mkdtempSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { execFileSync } from "node:child_process";
+
+const directory = mkdtempSync(join(tmpdir(), "batch-payouts-"));
+const input = join(directory, "payouts.json");
+writeFileSync(input, JSON.stringify([
+  { recipient: "0x000000000000000000000000000000000000a11c", amount: "15" },
+  { recipient: "0x0000000000000000000000000000000000000b0b", amount: "0x10" },
+]));
+const output = execFileSync(process.execPath, ["scripts/encode-payments.mjs", input], { encoding: "utf8" }).trim();
+assert.equal(output.length, 2 + 2 * 52 * 2);
+assert.equal(output.slice(2, 42), "000000000000000000000000000000000000a11c");
+assert.equal(output.slice(-64), "10".padStart(64, "0"));
diff --git a/src/ERC20BatchDistributor.sol b/src/ERC20BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..49f6c443b8f1130a416caeba86085c7bc202a2df
--- /dev/null
+++ b/src/ERC20BatchDistributor.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Sends balances held by this contract to many recipients in one transaction.
+/// @dev Only the immutable relayer/owner may execute or withdraw. Each payment is
+///      encoded as 20 bytes of recipient followed by 32 bytes of uint256 amount.
+contract ERC20BatchDistributor {
+    error Unauthorized();
+    error InvalidPaymentData();
+    error TokenHasNoCode();
+    error TokenTransferFailed();
+
+    uint256 private constant PAYMENT_SIZE = 52;
+    address public immutable owner;
+
+    event BatchTransferred(address indexed token, uint256 paymentCount);
+    event Withdrawn(address indexed token, address indexed recipient, uint256 amount);
+
+    constructor() {
+        owner = msg.sender;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    /// @notice Transfer a prefunded ERC-20 balance to each packed payment recipient.
+    /// @param token ERC-20 held by this contract.
+    /// @param payments Concatenated {address (20 bytes), amount (32 bytes)} records.
+    function batchTransfer(address token, bytes calldata payments) external onlyOwner {
+        uint256 length = payments.length;
+        if (length == 0 || length % PAYMENT_SIZE != 0) revert InvalidPaymentData();
+        if (token.code.length == 0) revert TokenHasNoCode();
+
+        for (uint256 offset; offset < length;) {
+            address recipient;
+            uint256 amount;
+            assembly ("memory-safe") {
+                recipient := shr(96, calldataload(add(payments.offset, offset)))
+                amount := calldataload(add(add(payments.offset, offset), 20))
+            }
+            _safeTransfer(token, recipient, amount);
+            unchecked {
+                offset += PAYMENT_SIZE;
+            }
+        }
+
+        emit BatchTransferred(token, length / PAYMENT_SIZE);
+    }
+
+    /// @notice Recover an ERC-20 balance. This is intentionally owner-only because
+    ///         this contract is a relayer-controlled custody address.
+    function withdraw(address token, address recipient, uint256 amount) external onlyOwner {
+        if (token.code.length == 0) revert TokenHasNoCode();
+        _safeTransfer(token, recipient, amount);
+        emit Withdrawn(token, recipient, amount);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount) private {
+        assembly ("memory-safe") {
+            let pointer := mload(0x40)
+            // transfer(address,uint256)
+            mstore(pointer, 0xa9059cbb00000000000000000000000000000000000000000000000000000000)
+            mstore(add(pointer, 4), recipient)
+            mstore(add(pointer, 36), amount)
+
+            let success := call(gas(), token, 0, pointer, 68, 0, 32)
+            let returnSize := returndatasize()
+            // Permit both standard `true` and legacy no-return ERC-20s.
+            let returnedTrue := and(iszero(lt(returnSize, 32)), eq(mload(0), 1))
+            if iszero(and(success, or(iszero(returnSize), returnedTrue))) {
+                mstore(0, 0x7c8f8d3b) // TokenTransferFailed()
+                revert(28, 4)
+            }
+        }
+    }
+}
diff --git a/test/ERC20BatchDistributor.t.sol b/test/ERC20BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..22aac7736103251705e73b91f34223f4c74e0f12
--- /dev/null
+++ b/test/ERC20BatchDistributor.t.sol
@@ -0,0 +1,67 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {ERC20BatchDistributor} from "../src/ERC20BatchDistributor.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    function mint(address account, uint256 amount) external {
+        balanceOf[account] += amount;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        require(balanceOf[msg.sender] >= amount, "insufficient balance");
+        unchecked {
+            balanceOf[msg.sender] -= amount;
+            balanceOf[to] += amount;
+        }
+        return true;
+    }
+}
+
+contract ERC20BatchDistributorTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    ERC20BatchDistributor private distributor;
+    MockERC20 private token;
+    address private constant ALICE = address(0xA11CE);
+    address private constant BOB = address(0xB0B);
+    address private constant ATTACKER = address(0xBAD);
+
+    function setUp() public {
+        distributor = new ERC20BatchDistributor();
+        token = new MockERC20();
+        token.mint(address(distributor), 1_000 ether);
+    }
+
+    function testBatchTransfersPackedPayments() public {
+        bytes memory payments = abi.encodePacked(ALICE, uint256(123 ether), BOB, uint256(7 ether));
+        distributor.batchTransfer(address(token), payments);
+
+        require(token.balanceOf(ALICE) == 123 ether, "alice was not paid");
+        require(token.balanceOf(BOB) == 7 ether, "bob was not paid");
+        require(token.balanceOf(address(distributor)) == 870 ether, "wrong remaining balance");
+    }
+
+    function testRejectsUnalignedPaymentData() public {
+        vm.expectRevert(ERC20BatchDistributor.InvalidPaymentData.selector);
+        distributor.batchTransfer(address(token), hex"00");
+    }
+
+    function testOnlyRelayerCanSpendCustodiedFunds() public {
+        bytes memory payments = abi.encodePacked(ALICE, uint256(1 ether));
+        vm.prank(ATTACKER);
+        vm.expectRevert(ERC20BatchDistributor.Unauthorized.selector);
+        distributor.batchTransfer(address(token), payments);
+    }
+
+    function testOwnerCanRecoverFunds() public {
+        distributor.withdraw(address(token), ALICE, 10 ether);
+        require(token.balanceOf(ALICE) == 10 ether, "withdraw failed");
+    }
+}

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7adf701fd0ca76ccd6e11afa11817859a3f5ac50
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 1000000
+via_ir = true
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..912e1e44cc8334f19c06eff69919c5a3ea9b9683
--- a/package.json
+++ b/package.json
@@ -1,4 +1,10 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test:encoder": "node scripts/encode-payments.test.mjs",
+    "test:contracts": "forge test",
+    "test": "npm run test:encoder && npm run test:contracts"
+  }
 }
diff --git a/scripts/encode-payments.mjs b/scripts/encode-payments.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..71282a38c8c0b063b2d6100179d1bc1cd21ef125
--- /dev/null
+++ b/scripts/encode-payments.mjs
@@ -0,0 +1,46 @@
+#!/usr/bin/env node
+/*
+ * Convert a payout JSON array into the compact calldata used by
+ * ERC20BatchDistributor.batchTransfer(address,bytes).
+ *
+ * Input:  [{"recipient":"0x...20-byte address...", "amount":"1230000"}]
+ * Output: 0x{20-byte recipient}{32-byte uint256}...
+ */
+import { readFileSync } from "node:fs";
+
+const [inputFile] = process.argv.slice(2);
+if (!inputFile) {
+  console.error("Usage: node scripts/encode-payments.mjs payouts.json");
+  process.exit(1);
+}
+
+let payments;
+try {
+  payments = JSON.parse(readFileSync(inputFile, "utf8"));
+} catch (error) {
+  console.error(`Cannot read payout JSON: ${error.message}`);
+  process.exit(1);
+}
+
+if (!Array.isArray(payments) || payments.length === 0) {
+  console.error("Payout JSON must be a non-empty array.");
+  process.exit(1);
+}
+
+const encoded = payments.map((payment, index) => {
+  if (!payment || typeof payment.recipient !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(payment.recipient)) {
+    throw new Error(`Payment ${index}: recipient must be a 20-byte 0x address.`);
+  }
+  let amount;
+  try {
+    amount = BigInt(payment.amount);
+  } catch {
+    throw new Error(`Payment ${index}: amount must be an integer accepted by BigInt.`);
+  }
+  if (amount < 0n || amount >= (1n << 256n)) {
+    throw new Error(`Payment ${index}: amount is outside uint256.`);
+  }
+  return payment.recipient.slice(2).toLowerCase() + amount.toString(16).padStart(64, "0");
+});
+
+console.log(`0x${encoded.join("")}`);
diff --git a/scripts/encode-payments.test.mjs b/scripts/encode-payments.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..54f413595943b38b677e46fac306a17d25ec6cdd
--- /dev/null
+++ b/scripts/encode-payments.test.mjs
@@ -0,0 +1,16 @@
+import assert from "node:assert/strict";
+import { mkdtempSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { execFileSync } from "node:child_process";
+
+const directory = mkdtempSync(join(tmpdir(), "batch-payouts-"));
+const input = join(directory, "payouts.json");
+writeFileSync(input, JSON.stringify([
+  { recipient: "0x000000000000000000000000000000000000a11c", amount: "15" },
+  { recipient: "0x0000000000000000000000000000000000000b0b", amount: "0x10" },
+]));
+const output = execFileSync(process.execPath, ["scripts/encode-payments.mjs", input], { encoding: "utf8" }).trim();
+assert.equal(output.length, 2 + 2 * 52 * 2);
+assert.equal(output.slice(2, 42), "000000000000000000000000000000000000a11c");
+assert.equal(output.slice(-64), "10".padStart(64, "0"));
diff --git a/src/ERC20BatchDistributor.sol b/src/ERC20BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..49f6c443b8f1130a416caeba86085c7bc202a2df
--- /dev/null
+++ b/src/ERC20BatchDistributor.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Sends balances held by this contract to many recipients in one transaction.
+/// @dev Only the immutable relayer/owner may execute or withdraw. Each payment is
+///      encoded as 20 bytes of recipient followed by 32 bytes of uint256 amount.
+contract ERC20BatchDistributor {
+    error Unauthorized();
+    error InvalidPaymentData();
+    error TokenHasNoCode();
+    error TokenTransferFailed();
+
+    uint256 private constant PAYMENT_SIZE = 52;
+    address public immutable owner;
+
+    event BatchTransferred(address indexed token, uint256 paymentCount);
+    event Withdrawn(address indexed token, address indexed recipient, uint256 amount);
+
+    constructor() {
+        owner = msg.sender;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    /// @notice Transfer a prefunded ERC-20 balance to each packed payment recipient.
+    /// @param token ERC-20 held by this contract.
+    /// @param payments Concatenated {address (20 bytes), amount (32 bytes)} records.
+    function batchTransfer(address token, bytes calldata payments) external onlyOwner {
+        uint256 length = payments.length;
+        if (length == 0 || length % PAYMENT_SIZE != 0) revert InvalidPaymentData();
+        if (token.code.length == 0) revert TokenHasNoCode();
+
+        for (uint256 offset; offset < length;) {
+            address recipient;
+            uint256 amount;
+            assembly ("memory-safe") {
+                recipient := shr(96, calldataload(add(payments.offset, offset)))
+                amount := calldataload(add(add(payments.offset, offset), 20))
+            }
+            _safeTransfer(token, recipient, amount);
+            unchecked {
+                offset += PAYMENT_SIZE;
+            }
+        }
+
+        emit BatchTransferred(token, length / PAYMENT_SIZE);
+    }
+
+    /// @notice Recover an ERC-20 balance. This is intentionally owner-only because
+    ///         this contract is a relayer-controlled custody address.
+    function withdraw(address token, address recipient, uint256 amount) external onlyOwner {
+        if (token.code.length == 0) revert TokenHasNoCode();
+        _safeTransfer(token, recipient, amount);
+        emit Withdrawn(token, recipient, amount);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount) private {
+        assembly ("memory-safe") {
+            let pointer := mload(0x40)
+            // transfer(address,uint256)
+            mstore(pointer, 0xa9059cbb00000000000000000000000000000000000000000000000000000000)
+            mstore(add(pointer, 4), recipient)
+            mstore(add(pointer, 36), amount)
+
+            let success := call(gas(), token, 0, pointer, 68, 0, 32)
+            let returnSize := returndatasize()
+            // Permit both standard `true` and legacy no-return ERC-20s.
+            let returnedTrue := and(iszero(lt(returnSize, 32)), eq(mload(0), 1))
+            if iszero(and(success, or(iszero(returnSize), returnedTrue))) {
+                mstore(0, 0x7c8f8d3b) // TokenTransferFailed()
+                revert(28, 4)
+            }
+        }
+    }
+}
diff --git a/test/ERC20BatchDistributor.t.sol b/test/ERC20BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..22aac7736103251705e73b91f34223f4c74e0f12
--- /dev/null
+++ b/test/ERC20BatchDistributor.t.sol
@@ -0,0 +1,67 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {ERC20BatchDistributor} from "../src/ERC20BatchDistributor.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    function mint(address account, uint256 amount) external {
+        balanceOf[account] += amount;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        require(balanceOf[msg.sender] >= amount, "insufficient balance");
+        unchecked {
+            balanceOf[msg.sender] -= amount;
+            balanceOf[to] += amount;
+        }
+        return true;
+    }
+}
+
+contract ERC20BatchDistributorTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    ERC20BatchDistributor private distributor;
+    MockERC20 private token;
+    address private constant ALICE = address(0xA11CE);
+    address private constant BOB = address(0xB0B);
+    address private constant ATTACKER = address(0xBAD);
+
+    function setUp() public {
+        distributor = new ERC20BatchDistributor();
+        token = new MockERC20();
+        token.mint(address(distributor), 1_000 ether);
+    }
+
+    function testBatchTransfersPackedPayments() public {
+        bytes memory payments = abi.encodePacked(ALICE, uint256(123 ether), BOB, uint256(7 ether));
+        distributor.batchTransfer(address(token), payments);
+
+        require(token.balanceOf(ALICE) == 123 ether, "alice was not paid");
+        require(token.balanceOf(BOB) == 7 ether, "bob was not paid");
+        require(token.balanceOf(address(distributor)) == 870 ether, "wrong remaining balance");
+    }
+
+    function testRejectsUnalignedPaymentData() public {
+        vm.expectRevert(ERC20BatchDistributor.InvalidPaymentData.selector);
+        distributor.batchTransfer(address(token), hex"00");
+    }
+
+    function testOnlyRelayerCanSpendCustodiedFunds() public {
+        bytes memory payments = abi.encodePacked(ALICE, uint256(1 ether));
+        vm.prank(ATTACKER);
+        vm.expectRevert(ERC20BatchDistributor.Unauthorized.selector);
+        distributor.batchTransfer(address(token), payments);
+    }
+
+    function testOwnerCanRecoverFunds() public {
+        distributor.withdraw(address(token), ALICE, 10 ether);
+        require(token.balanceOf(ALICE) == 10 ether, "withdraw failed");
+    }
+}

exec
/bin/bash -lc 'npm test && forge test --gas-report' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T000812Z-codex-no-skill-2/gas-goal-002
 succeeded in 1874ms:

> test
> npm run test:encoder && npm run test:contracts


> test:encoder
> node scripts/encode-payments.test.mjs


> test:contracts
> forge test

Compiling 2 files with Solc 0.8.24
Solc 0.8.24 finished in 591.82ms
Compiler run successful!

Ran 4 tests for test/ERC20BatchDistributor.t.sol:ERC20BatchDistributorTest
[PASS] testBatchTransfersPackedPayments() (gas: 66380)
[PASS] testOnlyRelayerCanSpendCustodiedFunds() (gas: 11507)
[PASS] testOwnerCanRecoverFunds() (gas: 40883)
[PASS] testRejectsUnalignedPaymentData() (gas: 10748)
Suite result: ok. 4 passed; 0 failed; 0 skipped; finished in 481.07µs (649.78µs CPU time)

Ran 1 test suite in 14.20ms (481.07µs CPU time): 4 tests passed, 0 failed, 0 skipped (4 total tests)
No files changed, compilation skipped

Ran 4 tests for test/ERC20BatchDistributor.t.sol:ERC20BatchDistributorTest
[PASS] testBatchTransfersPackedPayments() (gas: 101820)
[PASS] testOnlyRelayerCanSpendCustodiedFunds() (gas: 33583)
[PASS] testOwnerCanRecoverFunds() (gas: 64679)
[PASS] testRejectsUnalignedPaymentData() (gas: 32588)
Suite result: ok. 4 passed; 0 failed; 0 skipped; finished in 512.42µs (647.19µs CPU time)

╭--------------------------------------------------------------+-----------------+-------+--------+-------+---------╮
| src/ERC20BatchDistributor.sol:ERC20BatchDistributor Contract |                 |       |        |       |         |
+===================================================================================================================+
| Deployment Cost                                              | Deployment Size |       |        |       |         |
|--------------------------------------------------------------+-----------------+-------+--------+-------+---------|
| 280956                                                       | 1118            |       |        |       |         |
|--------------------------------------------------------------+-----------------+-------+--------+-------+---------|
|                                                              |                 |       |        |       |         |
|--------------------------------------------------------------+-----------------+-------+--------+-------+---------|
| Function Name                                                | Min             | Avg   | Median | Max   | # Calls |
|--------------------------------------------------------------+-----------------+-------+--------+-------+---------|
| batchTransfer                                                | 22313           | 40994 | 22471  | 78198 | 3       |
|--------------------------------------------------------------+-----------------+-------+--------+-------+---------|
| withdraw                                                     | 54482           | 54482 | 54482  | 54482 | 1       |
╰--------------------------------------------------------------+-----------------+-------+--------+-------+---------╯

╭-----------------------------------------------------+-----------------+-------+--------+-------+---------╮
| test/ERC20BatchDistributor.t.sol:MockERC20 Contract |                 |       |        |       |         |
+==========================================================================================================+
| Deployment Cost                                     | Deployment Size |       |        |       |         |
|-----------------------------------------------------+-----------------+-------+--------+-------+---------|
| 187296                                              | 650             |       |        |       |         |
|-----------------------------------------------------+-----------------+-------+--------+-------+---------|
|                                                     |                 |       |        |       |         |
|-----------------------------------------------------+-----------------+-------+--------+-------+---------|
| Function Name                                       | Min             | Avg   | Median | Max   | # Calls |
|-----------------------------------------------------+-----------------+-------+--------+-------+---------|
| balanceOf                                           | 2400            | 2400  | 2400   | 2400  | 4       |
|-----------------------------------------------------+-----------------+-------+--------+-------+---------|
| mint                                                | 44032           | 44032 | 44032  | 44032 | 4       |
╰-----------------------------------------------------+-----------------+-------+--------+-------+---------╯


Ran 1 test suite in 7.81ms (512.42µs CPU time): 4 tests passed, 0 failed, 0 skipped (4 total tests)

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7adf701fd0ca76ccd6e11afa11817859a3f5ac50
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 1000000
+via_ir = true
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..912e1e44cc8334f19c06eff69919c5a3ea9b9683
--- a/package.json
+++ b/package.json
@@ -1,4 +1,10 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test:encoder": "node scripts/encode-payments.test.mjs",
+    "test:contracts": "forge test",
+    "test": "npm run test:encoder && npm run test:contracts"
+  }
 }
diff --git a/scripts/encode-payments.mjs b/scripts/encode-payments.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..71282a38c8c0b063b2d6100179d1bc1cd21ef125
--- /dev/null
+++ b/scripts/encode-payments.mjs
@@ -0,0 +1,46 @@
+#!/usr/bin/env node
+/*
+ * Convert a payout JSON array into the compact calldata used by
+ * ERC20BatchDistributor.batchTransfer(address,bytes).
+ *
+ * Input:  [{"recipient":"0x...20-byte address...", "amount":"1230000"}]
+ * Output: 0x{20-byte recipient}{32-byte uint256}...
+ */
+import { readFileSync } from "node:fs";
+
+const [inputFile] = process.argv.slice(2);
+if (!inputFile) {
+  console.error("Usage: node scripts/encode-payments.mjs payouts.json");
+  process.exit(1);
+}
+
+let payments;
+try {
+  payments = JSON.parse(readFileSync(inputFile, "utf8"));
+} catch (error) {
+  console.error(`Cannot read payout JSON: ${error.message}`);
+  process.exit(1);
+}
+
+if (!Array.isArray(payments) || payments.length === 0) {
+  console.error("Payout JSON must be a non-empty array.");
+  process.exit(1);
+}
+
+const encoded = payments.map((payment, index) => {
+  if (!payment || typeof payment.recipient !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(payment.recipient)) {
+    throw new Error(`Payment ${index}: recipient must be a 20-byte 0x address.`);
+  }
+  let amount;
+  try {
+    amount = BigInt(payment.amount);
+  } catch {
+    throw new Error(`Payment ${index}: amount must be an integer accepted by BigInt.`);
+  }
+  if (amount < 0n || amount >= (1n << 256n)) {
+    throw new Error(`Payment ${index}: amount is outside uint256.`);
+  }
+  return payment.recipient.slice(2).toLowerCase() + amount.toString(16).padStart(64, "0");
+});
+
+console.log(`0x${encoded.join("")}`);
diff --git a/scripts/encode-payments.test.mjs b/scripts/encode-payments.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..54f413595943b38b677e46fac306a17d25ec6cdd
--- /dev/null
+++ b/scripts/encode-payments.test.mjs
@@ -0,0 +1,16 @@
+import assert from "node:assert/strict";
+import { mkdtempSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { execFileSync } from "node:child_process";
+
+const directory = mkdtempSync(join(tmpdir(), "batch-payouts-"));
+const input = join(directory, "payouts.json");
+writeFileSync(input, JSON.stringify([
+  { recipient: "0x000000000000000000000000000000000000a11c", amount: "15" },
+  { recipient: "0x0000000000000000000000000000000000000b0b", amount: "0x10" },
+]));
+const output = execFileSync(process.execPath, ["scripts/encode-payments.mjs", input], { encoding: "utf8" }).trim();
+assert.equal(output.length, 2 + 2 * 52 * 2);
+assert.equal(output.slice(2, 42), "000000000000000000000000000000000000a11c");
+assert.equal(output.slice(-64), "10".padStart(64, "0"));
diff --git a/src/ERC20BatchDistributor.sol b/src/ERC20BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..49f6c443b8f1130a416caeba86085c7bc202a2df
--- /dev/null
+++ b/src/ERC20BatchDistributor.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Sends balances held by this contract to many recipients in one transaction.
+/// @dev Only the immutable relayer/owner may execute or withdraw. Each payment is
+///      encoded as 20 bytes of recipient followed by 32 bytes of uint256 amount.
+contract ERC20BatchDistributor {
+    error Unauthorized();
+    error InvalidPaymentData();
+    error TokenHasNoCode();
+    error TokenTransferFailed();
+
+    uint256 private constant PAYMENT_SIZE = 52;
+    address public immutable owner;
+
+    event BatchTransferred(address indexed token, uint256 paymentCount);
+    event Withdrawn(address indexed token, address indexed recipient, uint256 amount);
+
+    constructor() {
+        owner = msg.sender;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    /// @notice Transfer a prefunded ERC-20 balance to each packed payment recipient.
+    /// @param token ERC-20 held by this contract.
+    /// @param payments Concatenated {address (20 bytes), amount (32 bytes)} records.
+    function batchTransfer(address token, bytes calldata payments) external onlyOwner {
+        uint256 length = payments.length;
+        if (length == 0 || length % PAYMENT_SIZE != 0) revert InvalidPaymentData();
+        if (token.code.length == 0) revert TokenHasNoCode();
+
+        for (uint256 offset; offset < length;) {
+            address recipient;
+            uint256 amount;
+            assembly ("memory-safe") {
+                recipient := shr(96, calldataload(add(payments.offset, offset)))
+                amount := calldataload(add(add(payments.offset, offset), 20))
+            }
+            _safeTransfer(token, recipient, amount);
+            unchecked {
+                offset += PAYMENT_SIZE;
+            }
+        }
+
+        emit BatchTransferred(token, length / PAYMENT_SIZE);
+    }
+
+    /// @notice Recover an ERC-20 balance. This is intentionally owner-only because
+    ///         this contract is a relayer-controlled custody address.
+    function withdraw(address token, address recipient, uint256 amount) external onlyOwner {
+        if (token.code.length == 0) revert TokenHasNoCode();
+        _safeTransfer(token, recipient, amount);
+        emit Withdrawn(token, recipient, amount);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount) private {
+        assembly ("memory-safe") {
+            let pointer := mload(0x40)
+            // transfer(address,uint256)
+            mstore(pointer, 0xa9059cbb00000000000000000000000000000000000000000000000000000000)
+            mstore(add(pointer, 4), recipient)
+            mstore(add(pointer, 36), amount)
+
+            let success := call(gas(), token, 0, pointer, 68, 0, 32)
+            let returnSize := returndatasize()
+            // Permit both standard `true` and legacy no-return ERC-20s.
+            let returnedTrue := and(iszero(lt(returnSize, 32)), eq(mload(0), 1))
+            if iszero(and(success, or(iszero(returnSize), returnedTrue))) {
+                mstore(0, 0x7c8f8d3b) // TokenTransferFailed()
+                revert(28, 4)
+            }
+        }
+    }
+}
diff --git a/test/ERC20BatchDistributor.t.sol b/test/ERC20BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..22aac7736103251705e73b91f34223f4c74e0f12
--- /dev/null
+++ b/test/ERC20BatchDistributor.t.sol
@@ -0,0 +1,67 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {ERC20BatchDistributor} from "../src/ERC20BatchDistributor.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    function mint(address account, uint256 amount) external {
+        balanceOf[account] += amount;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        require(balanceOf[msg.sender] >= amount, "insufficient balance");
+        unchecked {
+            balanceOf[msg.sender] -= amount;
+            balanceOf[to] += amount;
+        }
+        return true;
+    }
+}
+
+contract ERC20BatchDistributorTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    ERC20BatchDistributor private distributor;
+    MockERC20 private token;
+    address private constant ALICE = address(0xA11CE);
+    address private constant BOB = address(0xB0B);
+    address private constant ATTACKER = address(0xBAD);
+
+    function setUp() public {
+        distributor = new ERC20BatchDistributor();
+        token = new MockERC20();
+        token.mint(address(distributor), 1_000 ether);
+    }
+
+    function testBatchTransfersPackedPayments() public {
+        bytes memory payments = abi.encodePacked(ALICE, uint256(123 ether), BOB, uint256(7 ether));
+        distributor.batchTransfer(address(token), payments);
+
+        require(token.balanceOf(ALICE) == 123 ether, "alice was not paid");
+        require(token.balanceOf(BOB) == 7 ether, "bob was not paid");
+        require(token.balanceOf(address(distributor)) == 870 ether, "wrong remaining balance");
+    }
+
+    function testRejectsUnalignedPaymentData() public {
+        vm.expectRevert(ERC20BatchDistributor.InvalidPaymentData.selector);
+        distributor.batchTransfer(address(token), hex"00");
+    }
+
+    function testOnlyRelayerCanSpendCustodiedFunds() public {
+        bytes memory payments = abi.encodePacked(ALICE, uint256(1 ether));
+        vm.prank(ATTACKER);
+        vm.expectRevert(ERC20BatchDistributor.Unauthorized.selector);
+        distributor.batchTransfer(address(token), payments);
+    }
+
+    function testOwnerCanRecoverFunds() public {
+        distributor.withdraw(address(token), ALICE, 10 ether);
+        require(token.balanceOf(ALICE) == 10 ether, "withdraw failed");
+    }
+}

exec
/bin/bash -lc "cast keccak 'TokenTransferFailed()' && cast sig 'TokenTransferFailed()' && git diff --check && git status --short" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T000812Z-codex-no-skill-2/gas-goal-002
 succeeded in 6ms:
 M package.json
?? foundry.toml
?? scripts/
?? src/
?? test/

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7adf701fd0ca76ccd6e11afa11817859a3f5ac50
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 1000000
+via_ir = true
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..912e1e44cc8334f19c06eff69919c5a3ea9b9683
--- a/package.json
+++ b/package.json
@@ -1,4 +1,10 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test:encoder": "node scripts/encode-payments.test.mjs",
+    "test:contracts": "forge test",
+    "test": "npm run test:encoder && npm run test:contracts"
+  }
 }
diff --git a/scripts/encode-payments.mjs b/scripts/encode-payments.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..71282a38c8c0b063b2d6100179d1bc1cd21ef125
--- /dev/null
+++ b/scripts/encode-payments.mjs
@@ -0,0 +1,46 @@
+#!/usr/bin/env node
+/*
+ * Convert a payout JSON array into the compact calldata used by
+ * ERC20BatchDistributor.batchTransfer(address,bytes).
+ *
+ * Input:  [{"recipient":"0x...20-byte address...", "amount":"1230000"}]
+ * Output: 0x{20-byte recipient}{32-byte uint256}...
+ */
+import { readFileSync } from "node:fs";
+
+const [inputFile] = process.argv.slice(2);
+if (!inputFile) {
+  console.error("Usage: node scripts/encode-payments.mjs payouts.json");
+  process.exit(1);
+}
+
+let payments;
+try {
+  payments = JSON.parse(readFileSync(inputFile, "utf8"));
+} catch (error) {
+  console.error(`Cannot read payout JSON: ${error.message}`);
+  process.exit(1);
+}
+
+if (!Array.isArray(payments) || payments.length === 0) {
+  console.error("Payout JSON must be a non-empty array.");
+  process.exit(1);
+}
+
+const encoded = payments.map((payment, index) => {
+  if (!payment || typeof payment.recipient !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(payment.recipient)) {
+    throw new Error(`Payment ${index}: recipient must be a 20-byte 0x address.`);
+  }
+  let amount;
+  try {
+    amount = BigInt(payment.amount);
+  } catch {
+    throw new Error(`Payment ${index}: amount must be an integer accepted by BigInt.`);
+  }
+  if (amount < 0n || amount >= (1n << 256n)) {
+    throw new Error(`Payment ${index}: amount is outside uint256.`);
+  }
+  return payment.recipient.slice(2).toLowerCase() + amount.toString(16).padStart(64, "0");
+});
+
+console.log(`0x${encoded.join("")}`);
diff --git a/scripts/encode-payments.test.mjs b/scripts/encode-payments.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..54f413595943b38b677e46fac306a17d25ec6cdd
--- /dev/null
+++ b/scripts/encode-payments.test.mjs
@@ -0,0 +1,16 @@
+import assert from "node:assert/strict";
+import { mkdtempSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { execFileSync } from "node:child_process";
+
+const directory = mkdtempSync(join(tmpdir(), "batch-payouts-"));
+const input = join(directory, "payouts.json");
+writeFileSync(input, JSON.stringify([
+  { recipient: "0x000000000000000000000000000000000000a11c", amount: "15" },
+  { recipient: "0x0000000000000000000000000000000000000b0b", amount: "0x10" },
+]));
+const output = execFileSync(process.execPath, ["scripts/encode-payments.mjs", input], { encoding: "utf8" }).trim();
+assert.equal(output.length, 2 + 2 * 52 * 2);
+assert.equal(output.slice(2, 42), "000000000000000000000000000000000000a11c");
+assert.equal(output.slice(-64), "10".padStart(64, "0"));
diff --git a/src/ERC20BatchDistributor.sol b/src/ERC20BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..49f6c443b8f1130a416caeba86085c7bc202a2df
--- /dev/null
+++ b/src/ERC20BatchDistributor.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Sends balances held by this contract to many recipients in one transaction.
+/// @dev Only the immutable relayer/owner may execute or withdraw. Each payment is
+///      encoded as 20 bytes of recipient followed by 32 bytes of uint256 amount.
+contract ERC20BatchDistributor {
+    error Unauthorized();
+    error InvalidPaymentData();
+    error TokenHasNoCode();
+    error TokenTransferFailed();
+
+    uint256 private constant PAYMENT_SIZE = 52;
+    address public immutable owner;
+
+    event BatchTransferred(address indexed token, uint256 paymentCount);
+    event Withdrawn(address indexed token, address indexed recipient, uint256 amount);
+
+    constructor() {
+        owner = msg.sender;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    /// @notice Transfer a prefunded ERC-20 balance to each packed payment recipient.
+    /// @param token ERC-20 held by this contract.
+    /// @param payments Concatenated {address (20 bytes), amount (32 bytes)} records.
+    function batchTransfer(address token, bytes calldata payments) external onlyOwner {
+        uint256 length = payments.length;
+        if (length == 0 || length % PAYMENT_SIZE != 0) revert InvalidPaymentData();
+        if (token.code.length == 0) revert TokenHasNoCode();
+
+        for (uint256 offset; offset < length;) {
+            address recipient;
+            uint256 amount;
+            assembly ("memory-safe") {
+                recipient := shr(96, calldataload(add(payments.offset, offset)))
+                amount := calldataload(add(add(payments.offset, offset), 20))
+            }
+            _safeTransfer(token, recipient, amount);
+            unchecked {
+                offset += PAYMENT_SIZE;
+            }
+        }
+
+        emit BatchTransferred(token, length / PAYMENT_SIZE);
+    }
+
+    /// @notice Recover an ERC-20 balance. This is intentionally owner-only because
+    ///         this contract is a relayer-controlled custody address.
+    function withdraw(address token, address recipient, uint256 amount) external onlyOwner {
+        if (token.code.length == 0) revert TokenHasNoCode();
+        _safeTransfer(token, recipient, amount);
+        emit Withdrawn(token, recipient, amount);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount) private {
+        assembly ("memory-safe") {
+            let pointer := mload(0x40)
+            // transfer(address,uint256)
+            mstore(pointer, 0xa9059cbb00000000000000000000000000000000000000000000000000000000)
+            mstore(add(pointer, 4), recipient)
+            mstore(add(pointer, 36), amount)
+
+            let success := call(gas(), token, 0, pointer, 68, 0, 32)
+            let returnSize := returndatasize()
+            // Permit both standard `true` and legacy no-return ERC-20s.
+            let returnedTrue := and(iszero(lt(returnSize, 32)), eq(mload(0), 1))
+            if iszero(and(success, or(iszero(returnSize), returnedTrue))) {
+                mstore(0, 0x7c8f8d3b) // TokenTransferFailed()
+                revert(28, 4)
+            }
+        }
+    }
+}
diff --git a/test/ERC20BatchDistributor.t.sol b/test/ERC20BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..22aac7736103251705e73b91f34223f4c74e0f12
--- /dev/null
+++ b/test/ERC20BatchDistributor.t.sol
@@ -0,0 +1,67 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {ERC20BatchDistributor} from "../src/ERC20BatchDistributor.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    function mint(address account, uint256 amount) external {
+        balanceOf[account] += amount;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        require(balanceOf[msg.sender] >= amount, "insufficient balance");
+        unchecked {
+            balanceOf[msg.sender] -= amount;
+            balanceOf[to] += amount;
+        }
+        return true;
+    }
+}
+
+contract ERC20BatchDistributorTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    ERC20BatchDistributor private distributor;
+    MockERC20 private token;
+    address private constant ALICE = address(0xA11CE);
+    address private constant BOB = address(0xB0B);
+    address private constant ATTACKER = address(0xBAD);
+
+    function setUp() public {
+        distributor = new ERC20BatchDistributor();
+        token = new MockERC20();
+        token.mint(address(distributor), 1_000 ether);
+    }
+
+    function testBatchTransfersPackedPayments() public {
+        bytes memory payments = abi.encodePacked(ALICE, uint256(123 ether), BOB, uint256(7 ether));
+        distributor.batchTransfer(address(token), payments);
+
+        require(token.balanceOf(ALICE) == 123 ether, "alice was not paid");
+        require(token.balanceOf(BOB) == 7 ether, "bob was not paid");
+        require(token.balanceOf(address(distributor)) == 870 ether, "wrong remaining balance");
+    }
+
+    function testRejectsUnalignedPaymentData() public {
+        vm.expectRevert(ERC20BatchDistributor.InvalidPaymentData.selector);
+        distributor.batchTransfer(address(token), hex"00");
+    }
+
+    function testOnlyRelayerCanSpendCustodiedFunds() public {
+        bytes memory payments = abi.encodePacked(ALICE, uint256(1 ether));
+        vm.prank(ATTACKER);
+        vm.expectRevert(ERC20BatchDistributor.Unauthorized.selector);
+        distributor.batchTransfer(address(token), payments);
+    }
+
+    function testOwnerCanRecoverFunds() public {
+        distributor.withdraw(address(token), ALICE, 10 ether);
+        require(token.balanceOf(ALICE) == 10 ether, "withdraw failed");
+    }
+}

2026-08-28T00:11:21.453809Z ERROR codex_core::tools::router: error=apply_patch verification failed: invalid hunk at line 77, 'grouped by token. Keep a small prefunded working balance; the top-up itself is a' is not a valid hunk header. Valid hunk headers: '*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7adf701fd0ca76ccd6e11afa11817859a3f5ac50
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 1000000
+via_ir = true
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..912e1e44cc8334f19c06eff69919c5a3ea9b9683
--- a/package.json
+++ b/package.json
@@ -1,4 +1,10 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test:encoder": "node scripts/encode-payments.test.mjs",
+    "test:contracts": "forge test",
+    "test": "npm run test:encoder && npm run test:contracts"
+  }
 }
diff --git a/scripts/encode-payments.mjs b/scripts/encode-payments.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..71282a38c8c0b063b2d6100179d1bc1cd21ef125
--- /dev/null
+++ b/scripts/encode-payments.mjs
@@ -0,0 +1,46 @@
+#!/usr/bin/env node
+/*
+ * Convert a payout JSON array into the compact calldata used by
+ * ERC20BatchDistributor.batchTransfer(address,bytes).
+ *
+ * Input:  [{"recipient":"0x...20-byte address...", "amount":"1230000"}]
+ * Output: 0x{20-byte recipient}{32-byte uint256}...
+ */
+import { readFileSync } from "node:fs";
+
+const [inputFile] = process.argv.slice(2);
+if (!inputFile) {
+  console.error("Usage: node scripts/encode-payments.mjs payouts.json");
+  process.exit(1);
+}
+
+let payments;
+try {
+  payments = JSON.parse(readFileSync(inputFile, "utf8"));
+} catch (error) {
+  console.error(`Cannot read payout JSON: ${error.message}`);
+  process.exit(1);
+}
+
+if (!Array.isArray(payments) || payments.length === 0) {
+  console.error("Payout JSON must be a non-empty array.");
+  process.exit(1);
+}
+
+const encoded = payments.map((payment, index) => {
+  if (!payment || typeof payment.recipient !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(payment.recipient)) {
+    throw new Error(`Payment ${index}: recipient must be a 20-byte 0x address.`);
+  }
+  let amount;
+  try {
+    amount = BigInt(payment.amount);
+  } catch {
+    throw new Error(`Payment ${index}: amount must be an integer accepted by BigInt.`);
+  }
+  if (amount < 0n || amount >= (1n << 256n)) {
+    throw new Error(`Payment ${index}: amount is outside uint256.`);
+  }
+  return payment.recipient.slice(2).toLowerCase() + amount.toString(16).padStart(64, "0");
+});
+
+console.log(`0x${encoded.join("")}`);
diff --git a/scripts/encode-payments.test.mjs b/scripts/encode-payments.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..54f413595943b38b677e46fac306a17d25ec6cdd
--- /dev/null
+++ b/scripts/encode-payments.test.mjs
@@ -0,0 +1,16 @@
+import assert from "node:assert/strict";
+import { mkdtempSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { execFileSync } from "node:child_process";
+
+const directory = mkdtempSync(join(tmpdir(), "batch-payouts-"));
+const input = join(directory, "payouts.json");
+writeFileSync(input, JSON.stringify([
+  { recipient: "0x000000000000000000000000000000000000a11c", amount: "15" },
+  { recipient: "0x0000000000000000000000000000000000000b0b", amount: "0x10" },
+]));
+const output = execFileSync(process.execPath, ["scripts/encode-payments.mjs", input], { encoding: "utf8" }).trim();
+assert.equal(output.length, 2 + 2 * 52 * 2);
+assert.equal(output.slice(2, 42), "000000000000000000000000000000000000a11c");
+assert.equal(output.slice(-64), "10".padStart(64, "0"));
diff --git a/src/ERC20BatchDistributor.sol b/src/ERC20BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..49f6c443b8f1130a416caeba86085c7bc202a2df
--- /dev/null
+++ b/src/ERC20BatchDistributor.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Sends balances held by this contract to many recipients in one transaction.
+/// @dev Only the immutable relayer/owner may execute or withdraw. Each payment is
+///      encoded as 20 bytes of recipient followed by 32 bytes of uint256 amount.
+contract ERC20BatchDistributor {
+    error Unauthorized();
+    error InvalidPaymentData();
+    error TokenHasNoCode();
+    error TokenTransferFailed();
+
+    uint256 private constant PAYMENT_SIZE = 52;
+    address public immutable owner;
+
+    event BatchTransferred(address indexed token, uint256 paymentCount);
+    event Withdrawn(address indexed token, address indexed recipient, uint256 amount);
+
+    constructor() {
+        owner = msg.sender;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    /// @notice Transfer a prefunded ERC-20 balance to each packed payment recipient.
+    /// @param token ERC-20 held by this contract.
+    /// @param payments Concatenated {address (20 bytes), amount (32 bytes)} records.
+    function batchTransfer(address token, bytes calldata payments) external onlyOwner {
+        uint256 length = payments.length;
+        if (length == 0 || length % PAYMENT_SIZE != 0) revert InvalidPaymentData();
+        if (token.code.length == 0) revert TokenHasNoCode();
+
+        for (uint256 offset; offset < length;) {
+            address recipient;
+            uint256 amount;
+            assembly ("memory-safe") {
+                recipient := shr(96, calldataload(add(payments.offset, offset)))
+                amount := calldataload(add(add(payments.offset, offset), 20))
+            }
+            _safeTransfer(token, recipient, amount);
+            unchecked {
+                offset += PAYMENT_SIZE;
+            }
+        }
+
+        emit BatchTransferred(token, length / PAYMENT_SIZE);
+    }
+
+    /// @notice Recover an ERC-20 balance. This is intentionally owner-only because
+    ///         this contract is a relayer-controlled custody address.
+    function withdraw(address token, address recipient, uint256 amount) external onlyOwner {
+        if (token.code.length == 0) revert TokenHasNoCode();
+        _safeTransfer(token, recipient, amount);
+        emit Withdrawn(token, recipient, amount);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount) private {
+        assembly ("memory-safe") {
+            let pointer := mload(0x40)
+            // transfer(address,uint256)
+            mstore(pointer, 0xa9059cbb00000000000000000000000000000000000000000000000000000000)
+            mstore(add(pointer, 4), recipient)
+            mstore(add(pointer, 36), amount)
+
+            let success := call(gas(), token, 0, pointer, 68, 0, 32)
+            let returnSize := returndatasize()
+            // Permit both standard `true` and legacy no-return ERC-20s.
+            let returnedTrue := and(iszero(lt(returnSize, 32)), eq(mload(0), 1))
+            if iszero(and(success, or(iszero(returnSize), returnedTrue))) {
+                mstore(0, 0x7c8f8d3b) // TokenTransferFailed()
+                revert(28, 4)
+            }
+        }
+    }
+}
diff --git a/test/ERC20BatchDistributor.t.sol b/test/ERC20BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..22aac7736103251705e73b91f34223f4c74e0f12
--- /dev/null
+++ b/test/ERC20BatchDistributor.t.sol
@@ -0,0 +1,67 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {ERC20BatchDistributor} from "../src/ERC20BatchDistributor.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    function mint(address account, uint256 amount) external {
+        balanceOf[account] += amount;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        require(balanceOf[msg.sender] >= amount, "insufficient balance");
+        unchecked {
+            balanceOf[msg.sender] -= amount;
+            balanceOf[to] += amount;
+        }
+        return true;
+    }
+}
+
+contract ERC20BatchDistributorTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    ERC20BatchDistributor private distributor;
+    MockERC20 private token;
+    address private constant ALICE = address(0xA11CE);
+    address private constant BOB = address(0xB0B);
+    address private constant ATTACKER = address(0xBAD);
+
+    function setUp() public {
+        distributor = new ERC20BatchDistributor();
+        token = new MockERC20();
+        token.mint(address(distributor), 1_000 ether);
+    }
+
+    function testBatchTransfersPackedPayments() public {
+        bytes memory payments = abi.encodePacked(ALICE, uint256(123 ether), BOB, uint256(7 ether));
+        distributor.batchTransfer(address(token), payments);
+
+        require(token.balanceOf(ALICE) == 123 ether, "alice was not paid");
+        require(token.balanceOf(BOB) == 7 ether, "bob was not paid");
+        require(token.balanceOf(address(distributor)) == 870 ether, "wrong remaining balance");
+    }
+
+    function testRejectsUnalignedPaymentData() public {
+        vm.expectRevert(ERC20BatchDistributor.InvalidPaymentData.selector);
+        distributor.batchTransfer(address(token), hex"00");
+    }
+
+    function testOnlyRelayerCanSpendCustodiedFunds() public {
+        bytes memory payments = abi.encodePacked(ALICE, uint256(1 ether));
+        vm.prank(ATTACKER);
+        vm.expectRevert(ERC20BatchDistributor.Unauthorized.selector);
+        distributor.batchTransfer(address(token), payments);
+    }
+
+    function testOwnerCanRecoverFunds() public {
+        distributor.withdraw(address(token), ALICE, 10 ether);
+        require(token.balanceOf(ALICE) == 10 ether, "withdraw failed");
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T000812Z-codex-no-skill-2/gas-goal-002/src/ERC20BatchDistributor.sol
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7adf701fd0ca76ccd6e11afa11817859a3f5ac50
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 1000000
+via_ir = true
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..912e1e44cc8334f19c06eff69919c5a3ea9b9683
--- a/package.json
+++ b/package.json
@@ -1,4 +1,10 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test:encoder": "node scripts/encode-payments.test.mjs",
+    "test:contracts": "forge test",
+    "test": "npm run test:encoder && npm run test:contracts"
+  }
 }
diff --git a/scripts/encode-payments.mjs b/scripts/encode-payments.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..71282a38c8c0b063b2d6100179d1bc1cd21ef125
--- /dev/null
+++ b/scripts/encode-payments.mjs
@@ -0,0 +1,46 @@
+#!/usr/bin/env node
+/*
+ * Convert a payout JSON array into the compact calldata used by
+ * ERC20BatchDistributor.batchTransfer(address,bytes).
+ *
+ * Input:  [{"recipient":"0x...20-byte address...", "amount":"1230000"}]
+ * Output: 0x{20-byte recipient}{32-byte uint256}...
+ */
+import { readFileSync } from "node:fs";
+
+const [inputFile] = process.argv.slice(2);
+if (!inputFile) {
+  console.error("Usage: node scripts/encode-payments.mjs payouts.json");
+  process.exit(1);
+}
+
+let payments;
+try {
+  payments = JSON.parse(readFileSync(inputFile, "utf8"));
+} catch (error) {
+  console.error(`Cannot read payout JSON: ${error.message}`);
+  process.exit(1);
+}
+
+if (!Array.isArray(payments) || payments.length === 0) {
+  console.error("Payout JSON must be a non-empty array.");
+  process.exit(1);
+}
+
+const encoded = payments.map((payment, index) => {
+  if (!payment || typeof payment.recipient !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(payment.recipient)) {
+    throw new Error(`Payment ${index}: recipient must be a 20-byte 0x address.`);
+  }
+  let amount;
+  try {
+    amount = BigInt(payment.amount);
+  } catch {
+    throw new Error(`Payment ${index}: amount must be an integer accepted by BigInt.`);
+  }
+  if (amount < 0n || amount >= (1n << 256n)) {
+    throw new Error(`Payment ${index}: amount is outside uint256.`);
+  }
+  return payment.recipient.slice(2).toLowerCase() + amount.toString(16).padStart(64, "0");
+});
+
+console.log(`0x${encoded.join("")}`);
diff --git a/scripts/encode-payments.test.mjs b/scripts/encode-payments.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..54f413595943b38b677e46fac306a17d25ec6cdd
--- /dev/null
+++ b/scripts/encode-payments.test.mjs
@@ -0,0 +1,16 @@
+import assert from "node:assert/strict";
+import { mkdtempSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { execFileSync } from "node:child_process";
+
+const directory = mkdtempSync(join(tmpdir(), "batch-payouts-"));
+const input = join(directory, "payouts.json");
+writeFileSync(input, JSON.stringify([
+  { recipient: "0x000000000000000000000000000000000000a11c", amount: "15" },
+  { recipient: "0x0000000000000000000000000000000000000b0b", amount: "0x10" },
+]));
+const output = execFileSync(process.execPath, ["scripts/encode-payments.mjs", input], { encoding: "utf8" }).trim();
+assert.equal(output.length, 2 + 2 * 52 * 2);
+assert.equal(output.slice(2, 42), "000000000000000000000000000000000000a11c");
+assert.equal(output.slice(-64), "10".padStart(64, "0"));
diff --git a/src/ERC20BatchDistributor.sol b/src/ERC20BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a7303836221167d9b2a00fcc66bdab76ab4d73b7
--- /dev/null
+++ b/src/ERC20BatchDistributor.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Sends balances held by this contract to many recipients in one transaction.
+/// @dev Only the immutable relayer/owner may execute or withdraw. Each payment is
+///      encoded as 20 bytes of recipient followed by 32 bytes of uint256 amount.
+contract ERC20BatchDistributor {
+    error Unauthorized();
+    error InvalidPaymentData();
+    error TokenHasNoCode();
+    error TokenTransferFailed();
+
+    uint256 private constant PAYMENT_SIZE = 52;
+    address public immutable owner;
+
+    event BatchTransferred(address indexed token, uint256 paymentCount);
+    event Withdrawn(address indexed token, address indexed recipient, uint256 amount);
+
+    constructor() {
+        owner = msg.sender;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    /// @notice Transfer a prefunded ERC-20 balance to each packed payment recipient.
+    /// @param token ERC-20 held by this contract.
+    /// @param payments Concatenated {address (20 bytes), amount (32 bytes)} records.
+    function batchTransfer(address token, bytes calldata payments) external onlyOwner {
+        uint256 length = payments.length;
+        if (length == 0 || length % PAYMENT_SIZE != 0) revert InvalidPaymentData();
+        if (token.code.length == 0) revert TokenHasNoCode();
+
+        for (uint256 offset; offset < length;) {
+            address recipient;
+            uint256 amount;
+            assembly ("memory-safe") {
+                recipient := shr(96, calldataload(add(payments.offset, offset)))
+                amount := calldataload(add(add(payments.offset, offset), 20))
+            }
+            _safeTransfer(token, recipient, amount);
+            unchecked {
+                offset += PAYMENT_SIZE;
+            }
+        }
+
+        emit BatchTransferred(token, length / PAYMENT_SIZE);
+    }
+
+    /// @notice Recover an ERC-20 balance. This is intentionally owner-only because
+    ///         this contract is a relayer-controlled custody address.
+    function withdraw(address token, address recipient, uint256 amount) external onlyOwner {
+        if (token.code.length == 0) revert TokenHasNoCode();
+        _safeTransfer(token, recipient, amount);
+        emit Withdrawn(token, recipient, amount);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount) private {
+        assembly ("memory-safe") {
+            let pointer := mload(0x40)
+            // transfer(address,uint256)
+            mstore(pointer, 0xa9059cbb00000000000000000000000000000000000000000000000000000000)
+            mstore(add(pointer, 4), recipient)
+            mstore(add(pointer, 36), amount)
+
+            let success := call(gas(), token, 0, pointer, 68, 0, 32)
+            let returnSize := returndatasize()
+            // Permit both standard `true` and legacy no-return ERC-20s.
+            let returnedTrue := and(iszero(lt(returnSize, 32)), eq(mload(0), 1))
+            if iszero(and(success, or(iszero(returnSize), returnedTrue))) {
+                mstore(0, 0x045c4b02) // TokenTransferFailed()
+                revert(28, 4)
+            }
+        }
+    }
+}
diff --git a/test/ERC20BatchDistributor.t.sol b/test/ERC20BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..22aac7736103251705e73b91f34223f4c74e0f12
--- /dev/null
+++ b/test/ERC20BatchDistributor.t.sol
@@ -0,0 +1,67 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {ERC20BatchDistributor} from "../src/ERC20BatchDistributor.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    function mint(address account, uint256 amount) external {
+        balanceOf[account] += amount;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        require(balanceOf[msg.sender] >= amount, "insufficient balance");
+        unchecked {
+            balanceOf[msg.sender] -= amount;
+            balanceOf[to] += amount;
+        }
+        return true;
+    }
+}
+
+contract ERC20BatchDistributorTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    ERC20BatchDistributor private distributor;
+    MockERC20 private token;
+    address private constant ALICE = address(0xA11CE);
+    address private constant BOB = address(0xB0B);
+    address private constant ATTACKER = address(0xBAD);
+
+    function setUp() public {
+        distributor = new ERC20BatchDistributor();
+        token = new MockERC20();
+        token.mint(address(distributor), 1_000 ether);
+    }
+
+    function testBatchTransfersPackedPayments() public {
+        bytes memory payments = abi.encodePacked(ALICE, uint256(123 ether), BOB, uint256(7 ether));
+        distributor.batchTransfer(address(token), payments);
+
+        require(token.balanceOf(ALICE) == 123 ether, "alice was not paid");
+        require(token.balanceOf(BOB) == 7 ether, "bob was not paid");
+        require(token.balanceOf(address(distributor)) == 870 ether, "wrong remaining balance");
+    }
+
+    function testRejectsUnalignedPaymentData() public {
+        vm.expectRevert(ERC20BatchDistributor.InvalidPaymentData.selector);
+        distributor.batchTransfer(address(token), hex"00");
+    }
+
+    function testOnlyRelayerCanSpendCustodiedFunds() public {
+        bytes memory payments = abi.encodePacked(ALICE, uint256(1 ether));
+        vm.prank(ATTACKER);
+        vm.expectRevert(ERC20BatchDistributor.Unauthorized.selector);
+        distributor.batchTransfer(address(token), payments);
+    }
+
+    function testOwnerCanRecoverFunds() public {
+        distributor.withdraw(address(token), ALICE, 10 ether);
+        require(token.balanceOf(ALICE) == 10 ether, "withdraw failed");
+    }
+}

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7adf701fd0ca76ccd6e11afa11817859a3f5ac50
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 1000000
+via_ir = true
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..912e1e44cc8334f19c06eff69919c5a3ea9b9683
--- a/package.json
+++ b/package.json
@@ -1,4 +1,10 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test:encoder": "node scripts/encode-payments.test.mjs",
+    "test:contracts": "forge test",
+    "test": "npm run test:encoder && npm run test:contracts"
+  }
 }
diff --git a/scripts/encode-payments.mjs b/scripts/encode-payments.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..71282a38c8c0b063b2d6100179d1bc1cd21ef125
--- /dev/null
+++ b/scripts/encode-payments.mjs
@@ -0,0 +1,46 @@
+#!/usr/bin/env node
+/*
+ * Convert a payout JSON array into the compact calldata used by
+ * ERC20BatchDistributor.batchTransfer(address,bytes).
+ *
+ * Input:  [{"recipient":"0x...20-byte address...", "amount":"1230000"}]
+ * Output: 0x{20-byte recipient}{32-byte uint256}...
+ */
+import { readFileSync } from "node:fs";
+
+const [inputFile] = process.argv.slice(2);
+if (!inputFile) {
+  console.error("Usage: node scripts/encode-payments.mjs payouts.json");
+  process.exit(1);
+}
+
+let payments;
+try {
+  payments = JSON.parse(readFileSync(inputFile, "utf8"));
+} catch (error) {
+  console.error(`Cannot read payout JSON: ${error.message}`);
+  process.exit(1);
+}
+
+if (!Array.isArray(payments) || payments.length === 0) {
+  console.error("Payout JSON must be a non-empty array.");
+  process.exit(1);
+}
+
+const encoded = payments.map((payment, index) => {
+  if (!payment || typeof payment.recipient !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(payment.recipient)) {
+    throw new Error(`Payment ${index}: recipient must be a 20-byte 0x address.`);
+  }
+  let amount;
+  try {
+    amount = BigInt(payment.amount);
+  } catch {
+    throw new Error(`Payment ${index}: amount must be an integer accepted by BigInt.`);
+  }
+  if (amount < 0n || amount >= (1n << 256n)) {
+    throw new Error(`Payment ${index}: amount is outside uint256.`);
+  }
+  return payment.recipient.slice(2).toLowerCase() + amount.toString(16).padStart(64, "0");
+});
+
+console.log(`0x${encoded.join("")}`);
diff --git a/scripts/encode-payments.test.mjs b/scripts/encode-payments.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..54f413595943b38b677e46fac306a17d25ec6cdd
--- /dev/null
+++ b/scripts/encode-payments.test.mjs
@@ -0,0 +1,16 @@
+import assert from "node:assert/strict";
+import { mkdtempSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { execFileSync } from "node:child_process";
+
+const directory = mkdtempSync(join(tmpdir(), "batch-payouts-"));
+const input = join(directory, "payouts.json");
+writeFileSync(input, JSON.stringify([
+  { recipient: "0x000000000000000000000000000000000000a11c", amount: "15" },
+  { recipient: "0x0000000000000000000000000000000000000b0b", amount: "0x10" },
+]));
+const output = execFileSync(process.execPath, ["scripts/encode-payments.mjs", input], { encoding: "utf8" }).trim();
+assert.equal(output.length, 2 + 2 * 52 * 2);
+assert.equal(output.slice(2, 42), "000000000000000000000000000000000000a11c");
+assert.equal(output.slice(-64), "10".padStart(64, "0"));
diff --git a/src/ERC20BatchDistributor.sol b/src/ERC20BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a7303836221167d9b2a00fcc66bdab76ab4d73b7
--- /dev/null
+++ b/src/ERC20BatchDistributor.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Sends balances held by this contract to many recipients in one transaction.
+/// @dev Only the immutable relayer/owner may execute or withdraw. Each payment is
+///      encoded as 20 bytes of recipient followed by 32 bytes of uint256 amount.
+contract ERC20BatchDistributor {
+    error Unauthorized();
+    error InvalidPaymentData();
+    error TokenHasNoCode();
+    error TokenTransferFailed();
+
+    uint256 private constant PAYMENT_SIZE = 52;
+    address public immutable owner;
+
+    event BatchTransferred(address indexed token, uint256 paymentCount);
+    event Withdrawn(address indexed token, address indexed recipient, uint256 amount);
+
+    constructor() {
+        owner = msg.sender;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    /// @notice Transfer a prefunded ERC-20 balance to each packed payment recipient.
+    /// @param token ERC-20 held by this contract.
+    /// @param payments Concatenated {address (20 bytes), amount (32 bytes)} records.
+    function batchTransfer(address token, bytes calldata payments) external onlyOwner {
+        uint256 length = payments.length;
+        if (length == 0 || length % PAYMENT_SIZE != 0) revert InvalidPaymentData();
+        if (token.code.length == 0) revert TokenHasNoCode();
+
+        for (uint256 offset; offset < length;) {
+            address recipient;
+            uint256 amount;
+            assembly ("memory-safe") {
+                recipient := shr(96, calldataload(add(payments.offset, offset)))
+                amount := calldataload(add(add(payments.offset, offset), 20))
+            }
+            _safeTransfer(token, recipient, amount);
+            unchecked {
+                offset += PAYMENT_SIZE;
+            }
+        }
+
+        emit BatchTransferred(token, length / PAYMENT_SIZE);
+    }
+
+    /// @notice Recover an ERC-20 balance. This is intentionally owner-only because
+    ///         this contract is a relayer-controlled custody address.
+    function withdraw(address token, address recipient, uint256 amount) external onlyOwner {
+        if (token.code.length == 0) revert TokenHasNoCode();
+        _safeTransfer(token, recipient, amount);
+        emit Withdrawn(token, recipient, amount);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount) private {
+        assembly ("memory-safe") {
+            let pointer := mload(0x40)
+            // transfer(address,uint256)
+            mstore(pointer, 0xa9059cbb00000000000000000000000000000000000000000000000000000000)
+            mstore(add(pointer, 4), recipient)
+            mstore(add(pointer, 36), amount)
+
+            let success := call(gas(), token, 0, pointer, 68, 0, 32)
+            let returnSize := returndatasize()
+            // Permit both standard `true` and legacy no-return ERC-20s.
+            let returnedTrue := and(iszero(lt(returnSize, 32)), eq(mload(0), 1))
+            if iszero(and(success, or(iszero(returnSize), returnedTrue))) {
+                mstore(0, 0x045c4b02) // TokenTransferFailed()
+                revert(28, 4)
+            }
+        }
+    }
+}
diff --git a/test/ERC20BatchDistributor.t.sol b/test/ERC20BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..22aac7736103251705e73b91f34223f4c74e0f12
--- /dev/null
+++ b/test/ERC20BatchDistributor.t.sol
@@ -0,0 +1,67 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {ERC20BatchDistributor} from "../src/ERC20BatchDistributor.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    function mint(address account, uint256 amount) external {
+        balanceOf[account] += amount;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        require(balanceOf[msg.sender] >= amount, "insufficient balance");
+        unchecked {
+            balanceOf[msg.sender] -= amount;
+            balanceOf[to] += amount;
+        }
+        return true;
+    }
+}
+
+contract ERC20BatchDistributorTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    ERC20BatchDistributor private distributor;
+    MockERC20 private token;
+    address private constant ALICE = address(0xA11CE);
+    address private constant BOB = address(0xB0B);
+    address private constant ATTACKER = address(0xBAD);
+
+    function setUp() public {
+        distributor = new ERC20BatchDistributor();
+        token = new MockERC20();
+        token.mint(address(distributor), 1_000 ether);
+    }
+
+    function testBatchTransfersPackedPayments() public {
+        bytes memory payments = abi.encodePacked(ALICE, uint256(123 ether), BOB, uint256(7 ether));
+        distributor.batchTransfer(address(token), payments);
+
+        require(token.balanceOf(ALICE) == 123 ether, "alice was not paid");
+        require(token.balanceOf(BOB) == 7 ether, "bob was not paid");
+        require(token.balanceOf(address(distributor)) == 870 ether, "wrong remaining balance");
+    }
+
+    function testRejectsUnalignedPaymentData() public {
+        vm.expectRevert(ERC20BatchDistributor.InvalidPaymentData.selector);
+        distributor.batchTransfer(address(token), hex"00");
+    }
+
+    function testOnlyRelayerCanSpendCustodiedFunds() public {
+        bytes memory payments = abi.encodePacked(ALICE, uint256(1 ether));
+        vm.prank(ATTACKER);
+        vm.expectRevert(ERC20BatchDistributor.Unauthorized.selector);
+        distributor.batchTransfer(address(token), payments);
+    }
+
+    function testOwnerCanRecoverFunds() public {
+        distributor.withdraw(address(token), ALICE, 10 ether);
+        require(token.balanceOf(ALICE) == 10 ether, "withdraw failed");
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T000812Z-codex-no-skill-2/gas-goal-002/PLAN.md
diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..30793bf033189e62dca23082b79a2f304975323b
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,61 @@
+# Base relayer gas plan
+
+## What is known now
+
+There is no transaction export or sender implementation in this workspace, so an exact historical ETH total cannot be reconstructed here. Base fees have three parts: L2 execution, L1 data, and (where applicable) the OP Stack operator fee. The first is the only part represented by the usual `gasUsed * gasPrice` number. Do not report that number alone as the total cost.
+
+Use the last 7 days of relayer transactions to populate this calculation:
+
+```
+daily total ETH = sum(l2GasUsed * l2GasPriceWei + l1DataFeeWei + operatorFeeWei) / 1e18
+daily USD       = daily total ETH * ETH_USD
+```
+
+Until that export is available, this is the useful planning baseline. A normal ERC-20 `transfer` to an already-funded recipient is conservatively modelled at **51,000 L2 gas**. At 40,000 transfers/day that is **2,040,000,000 L2 gas/day** or **744.6 billion L2 gas/year**, before L1 data and operator fees. If the L2 gas price is `P` gwei, that component alone is `2.04 × P ETH/day` (for example, 0.00204 ETH/day at 0.001 gwei). Replace 51,000 and P with the p50/p95 from the export; recipient balances, token implementation, and calldata affect it a lot.
+
+## Ranked changes
+
+The order below is by recurring saving, not by implementation convenience. Numbers are L2 execution gas; L1-data savings are additional unless noted.
+
+| Rank | Change | Daily saving at 40k/day | Why / assumptions |
+| --- | --- | ---: | --- |
+| 1 (when eligible) | Keep internal payments in an off-chain balance ledger and settle only withdrawals | **51,000 gas for every avoided transfer**; maximum **2.04B gas/day (100%)** | This changes the product/custody model. If 60% of payments stay internal, the saving is 1.224B gas/day. Publish balances, define withdrawal SLAs, and obtain legal/compliance approval before doing it. |
+| 2 | Batch 100 payouts per token using the shipped distributor | about **808M gas/day (39.6%)**, plus L1-data savings | Conservative model: 100 singles = 5.10M gas; one packed batch = about 3.08M gas. The batch preserves one ERC-20 transfer per recipient, but removes 99 transaction envelopes and makes repeated token calls warm. 40,000 transactions become **400**. Estimate actual token/recipient samples before committing to the percentage. |
+| 3 | Net duplicate `(token, recipient)` payouts within each batch/window before batching | **about 30,800 gas per payout eliminated after batching** | At a 10% duplicate rate that is roughly **123M gas/day** beyond batching. It must preserve invoice-level accounting and only net payments with compatible availability requirements. |
+| 4 | Send only during acceptable Base fee windows, with a service-level deadline | variable; only the price spread, not gas units | This does not reduce gas use. Savings are `daily fee × (current price - chosen price) / current price`; it matters only for payments that may wait. Never strand payroll/refunds for a fee target. |
+
+The conditional upper bound in rank 1 is larger than batching, but batching is the largest unconditional on-chain saving and is ready to pilot now.
+
+## Shipped implementation: compact batch distributor
+
+`src/ERC20BatchDistributor.sol` is a dependency-free Solidity 0.8.24 contract. The existing relayer deploys it, transfers each token's working balance into it, then calls `batchTransfer`. Only that deployer can spend or recover the contract's balance. The packed payload is deliberately **52 bytes/payment**:
+
+```
+20-byte recipient address || 32-byte uint256 token amount
+```
+
+This is smaller than ABI `address[]` + `uint256[]` encoding (64 bytes/payment, plus array headers) and avoids per-payment storage. The contract accepts both standard ERC-20 `true` responses and legacy no-return tokens; it reverts the whole batch on a failed transfer, which is required to avoid partial payrolls.
+
+Create the payload from decimal base units (not display units):
+
+```
+node scripts/encode-payments.mjs payouts.json
+cast send "$BATCHER" 'batchTransfer(address,bytes)' "$TOKEN" "$(node scripts/encode-payments.mjs payouts.json)" --rpc-url "$BASE_RPC" --private-key "$RELAYER_KEY"
+```
+
+Example `payouts.json`:
+
+```json
+[{"recipient":"0x1111111111111111111111111111111111111111","amount":"1250000"}]
+```
+
+Use batches of 50–200 as a starting point (100 is the financial model above), grouped by token. Keep a small prefunded working balance; the top-up itself is a separate transfer, so do not fund once per batch. The relayer key is now also the custody key for this balance: use its production signing controls and monitor the distributor balance.
+
+## Rollout and measurement
+
+1. Export 7 days of successful relayer sends including transaction input, `gasUsed`, effective L2 gas price, L1 data fee, and operator fee. Separate each token and whether the recipient balance was zero before payment.
+2. On Base Sepolia, estimate and send representative batches of 1, 10, 50, 100, and 200 for every supported token. Compare their **all-in** fees with the same payouts sent individually. A token that charges transfer fees, rebases, pauses, blacklists, or has unusual return data needs explicit integration tests before inclusion.
+3. Deploy with the relayer as owner, verify the source, fund a capped float, and shadow-build batches for a day. Check totals, recipient/amount ordering, idempotency keys, and reconciliation before broadcasting.
+4. Canary one token at 50 payments/batch, then increase to 100 after a full reconciliation cycle. Record `payment_count`, all-in fee, gas/payment, and failed/retried batches. Roll back by stopping new calls and using the owner-only `withdraw` function to return the float.
+
+Run the included checks with `npm test`. They compile the contract and verify packed decoding, authorization, malformed data rejection, and recovery.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7adf701fd0ca76ccd6e11afa11817859a3f5ac50
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 1000000
+via_ir = true
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..912e1e44cc8334f19c06eff69919c5a3ea9b9683
--- a/package.json
+++ b/package.json
@@ -1,4 +1,10 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test:encoder": "node scripts/encode-payments.test.mjs",
+    "test:contracts": "forge test",
+    "test": "npm run test:encoder && npm run test:contracts"
+  }
 }
diff --git a/scripts/encode-payments.mjs b/scripts/encode-payments.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..71282a38c8c0b063b2d6100179d1bc1cd21ef125
--- /dev/null
+++ b/scripts/encode-payments.mjs
@@ -0,0 +1,46 @@
+#!/usr/bin/env node
+/*
+ * Convert a payout JSON array into the compact calldata used by
+ * ERC20BatchDistributor.batchTransfer(address,bytes).
+ *
+ * Input:  [{"recipient":"0x...20-byte address...", "amount":"1230000"}]
+ * Output: 0x{20-byte recipient}{32-byte uint256}...
+ */
+import { readFileSync } from "node:fs";
+
+const [inputFile] = process.argv.slice(2);
+if (!inputFile) {
+  console.error("Usage: node scripts/encode-payments.mjs payouts.json");
+  process.exit(1);
+}
+
+let payments;
+try {
+  payments = JSON.parse(readFileSync(inputFile, "utf8"));
+} catch (error) {
+  console.error(`Cannot read payout JSON: ${error.message}`);
+  process.exit(1);
+}
+
+if (!Array.isArray(payments) || payments.length === 0) {
+  console.error("Payout JSON must be a non-empty array.");
+  process.exit(1);
+}
+
+const encoded = payments.map((payment, index) => {
+  if (!payment || typeof payment.recipient !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(payment.recipient)) {
+    throw new Error(`Payment ${index}: recipient must be a 20-byte 0x address.`);
+  }
+  let amount;
+  try {
+    amount = BigInt(payment.amount);
+  } catch {
+    throw new Error(`Payment ${index}: amount must be an integer accepted by BigInt.`);
+  }
+  if (amount < 0n || amount >= (1n << 256n)) {
+    throw new Error(`Payment ${index}: amount is outside uint256.`);
+  }
+  return payment.recipient.slice(2).toLowerCase() + amount.toString(16).padStart(64, "0");
+});
+
+console.log(`0x${encoded.join("")}`);
diff --git a/scripts/encode-payments.test.mjs b/scripts/encode-payments.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..54f413595943b38b677e46fac306a17d25ec6cdd
--- /dev/null
+++ b/scripts/encode-payments.test.mjs
@@ -0,0 +1,16 @@
+import assert from "node:assert/strict";
+import { mkdtempSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { execFileSync } from "node:child_process";
+
+const directory = mkdtempSync(join(tmpdir(), "batch-payouts-"));
+const input = join(directory, "payouts.json");
+writeFileSync(input, JSON.stringify([
+  { recipient: "0x000000000000000000000000000000000000a11c", amount: "15" },
+  { recipient: "0x0000000000000000000000000000000000000b0b", amount: "0x10" },
+]));
+const output = execFileSync(process.execPath, ["scripts/encode-payments.mjs", input], { encoding: "utf8" }).trim();
+assert.equal(output.length, 2 + 2 * 52 * 2);
+assert.equal(output.slice(2, 42), "000000000000000000000000000000000000a11c");
+assert.equal(output.slice(-64), "10".padStart(64, "0"));
diff --git a/src/ERC20BatchDistributor.sol b/src/ERC20BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a7303836221167d9b2a00fcc66bdab76ab4d73b7
--- /dev/null
+++ b/src/ERC20BatchDistributor.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Sends balances held by this contract to many recipients in one transaction.
+/// @dev Only the immutable relayer/owner may execute or withdraw. Each payment is
+///      encoded as 20 bytes of recipient followed by 32 bytes of uint256 amount.
+contract ERC20BatchDistributor {
+    error Unauthorized();
+    error InvalidPaymentData();
+    error TokenHasNoCode();
+    error TokenTransferFailed();
+
+    uint256 private constant PAYMENT_SIZE = 52;
+    address public immutable owner;
+
+    event BatchTransferred(address indexed token, uint256 paymentCount);
+    event Withdrawn(address indexed token, address indexed recipient, uint256 amount);
+
+    constructor() {
+        owner = msg.sender;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    /// @notice Transfer a prefunded ERC-20 balance to each packed payment recipient.
+    /// @param token ERC-20 held by this contract.
+    /// @param payments Concatenated {address (20 bytes), amount (32 bytes)} records.
+    function batchTransfer(address token, bytes calldata payments) external onlyOwner {
+        uint256 length = payments.length;
+        if (length == 0 || length % PAYMENT_SIZE != 0) revert InvalidPaymentData();
+        if (token.code.length == 0) revert TokenHasNoCode();
+
+        for (uint256 offset; offset < length;) {
+            address recipient;
+            uint256 amount;
+            assembly ("memory-safe") {
+                recipient := shr(96, calldataload(add(payments.offset, offset)))
+                amount := calldataload(add(add(payments.offset, offset), 20))
+            }
+            _safeTransfer(token, recipient, amount);
+            unchecked {
+                offset += PAYMENT_SIZE;
+            }
+        }
+
+        emit BatchTransferred(token, length / PAYMENT_SIZE);
+    }
+
+    /// @notice Recover an ERC-20 balance. This is intentionally owner-only because
+    ///         this contract is a relayer-controlled custody address.
+    function withdraw(address token, address recipient, uint256 amount) external onlyOwner {
+        if (token.code.length == 0) revert TokenHasNoCode();
+        _safeTransfer(token, recipient, amount);
+        emit Withdrawn(token, recipient, amount);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount) private {
+        assembly ("memory-safe") {
+            let pointer := mload(0x40)
+            // transfer(address,uint256)
+            mstore(pointer, 0xa9059cbb00000000000000000000000000000000000000000000000000000000)
+            mstore(add(pointer, 4), recipient)
+            mstore(add(pointer, 36), amount)
+
+            let success := call(gas(), token, 0, pointer, 68, 0, 32)
+            let returnSize := returndatasize()
+            // Permit both standard `true` and legacy no-return ERC-20s.
+            let returnedTrue := and(iszero(lt(returnSize, 32)), eq(mload(0), 1))
+            if iszero(and(success, or(iszero(returnSize), returnedTrue))) {
+                mstore(0, 0x045c4b02) // TokenTransferFailed()
+                revert(28, 4)
+            }
+        }
+    }
+}
diff --git a/test/ERC20BatchDistributor.t.sol b/test/ERC20BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..22aac7736103251705e73b91f34223f4c74e0f12
--- /dev/null
+++ b/test/ERC20BatchDistributor.t.sol
@@ -0,0 +1,67 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {ERC20BatchDistributor} from "../src/ERC20BatchDistributor.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    function mint(address account, uint256 amount) external {
+        balanceOf[account] += amount;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        require(balanceOf[msg.sender] >= amount, "insufficient balance");
+        unchecked {
+            balanceOf[msg.sender] -= amount;
+            balanceOf[to] += amount;
+        }
+        return true;
+    }
+}
+
+contract ERC20BatchDistributorTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    ERC20BatchDistributor private distributor;
+    MockERC20 private token;
+    address private constant ALICE = address(0xA11CE);
+    address private constant BOB = address(0xB0B);
+    address private constant ATTACKER = address(0xBAD);
+
+    function setUp() public {
+        distributor = new ERC20BatchDistributor();
+        token = new MockERC20();
+        token.mint(address(distributor), 1_000 ether);
+    }
+
+    function testBatchTransfersPackedPayments() public {
+        bytes memory payments = abi.encodePacked(ALICE, uint256(123 ether), BOB, uint256(7 ether));
+        distributor.batchTransfer(address(token), payments);
+
+        require(token.balanceOf(ALICE) == 123 ether, "alice was not paid");
+        require(token.balanceOf(BOB) == 7 ether, "bob was not paid");
+        require(token.balanceOf(address(distributor)) == 870 ether, "wrong remaining balance");
+    }
+
+    function testRejectsUnalignedPaymentData() public {
+        vm.expectRevert(ERC20BatchDistributor.InvalidPaymentData.selector);
+        distributor.batchTransfer(address(token), hex"00");
+    }
+
+    function testOnlyRelayerCanSpendCustodiedFunds() public {
+        bytes memory payments = abi.encodePacked(ALICE, uint256(1 ether));
+        vm.prank(ATTACKER);
+        vm.expectRevert(ERC20BatchDistributor.Unauthorized.selector);
+        distributor.batchTransfer(address(token), payments);
+    }
+
+    function testOwnerCanRecoverFunds() public {
+        distributor.withdraw(address(token), ALICE, 10 ether);
+        require(token.balanceOf(ALICE) == 10 ether, "withdraw failed");
+    }
+}

diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..30793bf033189e62dca23082b79a2f304975323b
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,61 @@
+# Base relayer gas plan
+
+## What is known now
+
+There is no transaction export or sender implementation in this workspace, so an exact historical ETH total cannot be reconstructed here. Base fees have three parts: L2 execution, L1 data, and (where applicable) the OP Stack operator fee. The first is the only part represented by the usual `gasUsed * gasPrice` number. Do not report that number alone as the total cost.
+
+Use the last 7 days of relayer transactions to populate this calculation:
+
+```
+daily total ETH = sum(l2GasUsed * l2GasPriceWei + l1DataFeeWei + operatorFeeWei) / 1e18
+daily USD       = daily total ETH * ETH_USD
+```
+
+Until that export is available, this is the useful planning baseline. A normal ERC-20 `transfer` to an already-funded recipient is conservatively modelled at **51,000 L2 gas**. At 40,000 transfers/day that is **2,040,000,000 L2 gas/day** or **744.6 billion L2 gas/year**, before L1 data and operator fees. If the L2 gas price is `P` gwei, that component alone is `2.04 × P ETH/day` (for example, 0.00204 ETH/day at 0.001 gwei). Replace 51,000 and P with the p50/p95 from the export; recipient balances, token implementation, and calldata affect it a lot.
+
+## Ranked changes
+
+The order below is by recurring saving, not by implementation convenience. Numbers are L2 execution gas; L1-data savings are additional unless noted.
+
+| Rank | Change | Daily saving at 40k/day | Why / assumptions |
+| --- | --- | ---: | --- |
+| 1 (when eligible) | Keep internal payments in an off-chain balance ledger and settle only withdrawals | **51,000 gas for every avoided transfer**; maximum **2.04B gas/day (100%)** | This changes the product/custody model. If 60% of payments stay internal, the saving is 1.224B gas/day. Publish balances, define withdrawal SLAs, and obtain legal/compliance approval before doing it. |
+| 2 | Batch 100 payouts per token using the shipped distributor | about **808M gas/day (39.6%)**, plus L1-data savings | Conservative model: 100 singles = 5.10M gas; one packed batch = about 3.08M gas. The batch preserves one ERC-20 transfer per recipient, but removes 99 transaction envelopes and makes repeated token calls warm. 40,000 transactions become **400**. Estimate actual token/recipient samples before committing to the percentage. |
+| 3 | Net duplicate `(token, recipient)` payouts within each batch/window before batching | **about 30,800 gas per payout eliminated after batching** | At a 10% duplicate rate that is roughly **123M gas/day** beyond batching. It must preserve invoice-level accounting and only net payments with compatible availability requirements. |
+| 4 | Send only during acceptable Base fee windows, with a service-level deadline | variable; only the price spread, not gas units | This does not reduce gas use. Savings are `daily fee × (current price - chosen price) / current price`; it matters only for payments that may wait. Never strand payroll/refunds for a fee target. |
+
+The conditional upper bound in rank 1 is larger than batching, but batching is the largest unconditional on-chain saving and is ready to pilot now.
+
+## Shipped implementation: compact batch distributor
+
+`src/ERC20BatchDistributor.sol` is a dependency-free Solidity 0.8.24 contract. The existing relayer deploys it, transfers each token's working balance into it, then calls `batchTransfer`. Only that deployer can spend or recover the contract's balance. The packed payload is deliberately **52 bytes/payment**:
+
+```
+20-byte recipient address || 32-byte uint256 token amount
+```
+
+This is smaller than ABI `address[]` + `uint256[]` encoding (64 bytes/payment, plus array headers) and avoids per-payment storage. The contract accepts both standard ERC-20 `true` responses and legacy no-return tokens; it reverts the whole batch on a failed transfer, which is required to avoid partial payrolls.
+
+Create the payload from decimal base units (not display units):
+
+```
+node scripts/encode-payments.mjs payouts.json
+cast send "$BATCHER" 'batchTransfer(address,bytes)' "$TOKEN" "$(node scripts/encode-payments.mjs payouts.json)" --rpc-url "$BASE_RPC" --private-key "$RELAYER_KEY"
+```
+
+Example `payouts.json`:
+
+```json
+[{"recipient":"0x1111111111111111111111111111111111111111","amount":"1250000"}]
+```
+
+Use batches of 50–200 as a starting point (100 is the financial model above), grouped by token. Keep a small prefunded working balance; the top-up itself is a separate transfer, so do not fund once per batch. The relayer key is now also the custody key for this balance: use its production signing controls and monitor the distributor balance.
+
+## Rollout and measurement
+
+1. Export 7 days of successful relayer sends including transaction input, `gasUsed`, effective L2 gas price, L1 data fee, and operator fee. Separate each token and whether the recipient balance was zero before payment.
+2. On Base Sepolia, estimate and send representative batches of 1, 10, 50, 100, and 200 for every supported token. Compare their **all-in** fees with the same payouts sent individually. A token that charges transfer fees, rebases, pauses, blacklists, or has unusual return data needs explicit integration tests before inclusion.
+3. Deploy with the relayer as owner, verify the source, fund a capped float, and shadow-build batches for a day. Check totals, recipient/amount ordering, idempotency keys, and reconciliation before broadcasting.
+4. Canary one token at 50 payments/batch, then increase to 100 after a full reconciliation cycle. Record `payment_count`, all-in fee, gas/payment, and failed/retried batches. Roll back by stopping new calls and using the owner-only `withdraw` function to return the float.
+
+Run the included checks with `npm test`. They compile the contract and verify packed decoding, authorization, malformed data rejection, and recovery.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7adf701fd0ca76ccd6e11afa11817859a3f5ac50
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 1000000
+via_ir = true
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..912e1e44cc8334f19c06eff69919c5a3ea9b9683
--- a/package.json
+++ b/package.json
@@ -1,4 +1,10 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test:encoder": "node scripts/encode-payments.test.mjs",
+    "test:contracts": "forge test",
+    "test": "npm run test:encoder && npm run test:contracts"
+  }
 }
diff --git a/scripts/encode-payments.mjs b/scripts/encode-payments.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..71282a38c8c0b063b2d6100179d1bc1cd21ef125
--- /dev/null
+++ b/scripts/encode-payments.mjs
@@ -0,0 +1,46 @@
+#!/usr/bin/env node
+/*
+ * Convert a payout JSON array into the compact calldata used by
+ * ERC20BatchDistributor.batchTransfer(address,bytes).
+ *
+ * Input:  [{"recipient":"0x...20-byte address...", "amount":"1230000"}]
+ * Output: 0x{20-byte recipient}{32-byte uint256}...
+ */
+import { readFileSync } from "node:fs";
+
+const [inputFile] = process.argv.slice(2);
+if (!inputFile) {
+  console.error("Usage: node scripts/encode-payments.mjs payouts.json");
+  process.exit(1);
+}
+
+let payments;
+try {
+  payments = JSON.parse(readFileSync(inputFile, "utf8"));
+} catch (error) {
+  console.error(`Cannot read payout JSON: ${error.message}`);
+  process.exit(1);
+}
+
+if (!Array.isArray(payments) || payments.length === 0) {
+  console.error("Payout JSON must be a non-empty array.");
+  process.exit(1);
+}
+
+const encoded = payments.map((payment, index) => {
+  if (!payment || typeof payment.recipient !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(payment.recipient)) {
+    throw new Error(`Payment ${index}: recipient must be a 20-byte 0x address.`);
+  }
+  let amount;
+  try {
+    amount = BigInt(payment.amount);
+  } catch {
+    throw new Error(`Payment ${index}: amount must be an integer accepted by BigInt.`);
+  }
+  if (amount < 0n || amount >= (1n << 256n)) {
+    throw new Error(`Payment ${index}: amount is outside uint256.`);
+  }
+  return payment.recipient.slice(2).toLowerCase() + amount.toString(16).padStart(64, "0");
+});
+
+console.log(`0x${encoded.join("")}`);
diff --git a/scripts/encode-payments.test.mjs b/scripts/encode-payments.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..54f413595943b38b677e46fac306a17d25ec6cdd
--- /dev/null
+++ b/scripts/encode-payments.test.mjs
@@ -0,0 +1,16 @@
+import assert from "node:assert/strict";
+import { mkdtempSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { execFileSync } from "node:child_process";
+
+const directory = mkdtempSync(join(tmpdir(), "batch-payouts-"));
+const input = join(directory, "payouts.json");
+writeFileSync(input, JSON.stringify([
+  { recipient: "0x000000000000000000000000000000000000a11c", amount: "15" },
+  { recipient: "0x0000000000000000000000000000000000000b0b", amount: "0x10" },
+]));
+const output = execFileSync(process.execPath, ["scripts/encode-payments.mjs", input], { encoding: "utf8" }).trim();
+assert.equal(output.length, 2 + 2 * 52 * 2);
+assert.equal(output.slice(2, 42), "000000000000000000000000000000000000a11c");
+assert.equal(output.slice(-64), "10".padStart(64, "0"));
diff --git a/src/ERC20BatchDistributor.sol b/src/ERC20BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a7303836221167d9b2a00fcc66bdab76ab4d73b7
--- /dev/null
+++ b/src/ERC20BatchDistributor.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Sends balances held by this contract to many recipients in one transaction.
+/// @dev Only the immutable relayer/owner may execute or withdraw. Each payment is
+///      encoded as 20 bytes of recipient followed by 32 bytes of uint256 amount.
+contract ERC20BatchDistributor {
+    error Unauthorized();
+    error InvalidPaymentData();
+    error TokenHasNoCode();
+    error TokenTransferFailed();
+
+    uint256 private constant PAYMENT_SIZE = 52;
+    address public immutable owner;
+
+    event BatchTransferred(address indexed token, uint256 paymentCount);
+    event Withdrawn(address indexed token, address indexed recipient, uint256 amount);
+
+    constructor() {
+        owner = msg.sender;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    /// @notice Transfer a prefunded ERC-20 balance to each packed payment recipient.
+    /// @param token ERC-20 held by this contract.
+    /// @param payments Concatenated {address (20 bytes), amount (32 bytes)} records.
+    function batchTransfer(address token, bytes calldata payments) external onlyOwner {
+        uint256 length = payments.length;
+        if (length == 0 || length % PAYMENT_SIZE != 0) revert InvalidPaymentData();
+        if (token.code.length == 0) revert TokenHasNoCode();
+
+        for (uint256 offset; offset < length;) {
+            address recipient;
+            uint256 amount;
+            assembly ("memory-safe") {
+                recipient := shr(96, calldataload(add(payments.offset, offset)))
+                amount := calldataload(add(add(payments.offset, offset), 20))
+            }
+            _safeTransfer(token, recipient, amount);
+            unchecked {
+                offset += PAYMENT_SIZE;
+            }
+        }
+
+        emit BatchTransferred(token, length / PAYMENT_SIZE);
+    }
+
+    /// @notice Recover an ERC-20 balance. This is intentionally owner-only because
+    ///         this contract is a relayer-controlled custody address.
+    function withdraw(address token, address recipient, uint256 amount) external onlyOwner {
+        if (token.code.length == 0) revert TokenHasNoCode();
+        _safeTransfer(token, recipient, amount);
+        emit Withdrawn(token, recipient, amount);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount) private {
+        assembly ("memory-safe") {
+            let pointer := mload(0x40)
+            // transfer(address,uint256)
+            mstore(pointer, 0xa9059cbb00000000000000000000000000000000000000000000000000000000)
+            mstore(add(pointer, 4), recipient)
+            mstore(add(pointer, 36), amount)
+
+            let success := call(gas(), token, 0, pointer, 68, 0, 32)
+            let returnSize := returndatasize()
+            // Permit both standard `true` and legacy no-return ERC-20s.
+            let returnedTrue := and(iszero(lt(returnSize, 32)), eq(mload(0), 1))
+            if iszero(and(success, or(iszero(returnSize), returnedTrue))) {
+                mstore(0, 0x045c4b02) // TokenTransferFailed()
+                revert(28, 4)
+            }
+        }
+    }
+}
diff --git a/test/ERC20BatchDistributor.t.sol b/test/ERC20BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..22aac7736103251705e73b91f34223f4c74e0f12
--- /dev/null
+++ b/test/ERC20BatchDistributor.t.sol
@@ -0,0 +1,67 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {ERC20BatchDistributor} from "../src/ERC20BatchDistributor.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    function mint(address account, uint256 amount) external {
+        balanceOf[account] += amount;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        require(balanceOf[msg.sender] >= amount, "insufficient balance");
+        unchecked {
+            balanceOf[msg.sender] -= amount;
+            balanceOf[to] += amount;
+        }
+        return true;
+    }
+}
+
+contract ERC20BatchDistributorTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    ERC20BatchDistributor private distributor;
+    MockERC20 private token;
+    address private constant ALICE = address(0xA11CE);
+    address private constant BOB = address(0xB0B);
+    address private constant ATTACKER = address(0xBAD);
+
+    function setUp() public {
+        distributor = new ERC20BatchDistributor();
+        token = new MockERC20();
+        token.mint(address(distributor), 1_000 ether);
+    }
+
+    function testBatchTransfersPackedPayments() public {
+        bytes memory payments = abi.encodePacked(ALICE, uint256(123 ether), BOB, uint256(7 ether));
+        distributor.batchTransfer(address(token), payments);
+
+        require(token.balanceOf(ALICE) == 123 ether, "alice was not paid");
+        require(token.balanceOf(BOB) == 7 ether, "bob was not paid");
+        require(token.balanceOf(address(distributor)) == 870 ether, "wrong remaining balance");
+    }
+
+    function testRejectsUnalignedPaymentData() public {
+        vm.expectRevert(ERC20BatchDistributor.InvalidPaymentData.selector);
+        distributor.batchTransfer(address(token), hex"00");
+    }
+
+    function testOnlyRelayerCanSpendCustodiedFunds() public {
+        bytes memory payments = abi.encodePacked(ALICE, uint256(1 ether));
+        vm.prank(ATTACKER);
+        vm.expectRevert(ERC20BatchDistributor.Unauthorized.selector);
+        distributor.batchTransfer(address(token), payments);
+    }
+
+    function testOwnerCanRecoverFunds() public {
+        distributor.withdraw(address(token), ALICE, 10 ether);
+        require(token.balanceOf(ALICE) == 10 ether, "withdraw failed");
+    }
+}

codex
The implementation and plan are now in place. I’ve kept the financial model explicit about what is estimated versus what must come from the relayer’s receipts—otherwise a “gas spend” figure would omit Base’s L1-data charges.
exec
/bin/bash -lc 'forge fmt --check && npm test && git diff --check && git status --short && git diff --stat' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T000812Z-codex-no-skill-2/gas-goal-002
 succeeded in 1830ms:

> test
> npm run test:encoder && npm run test:contracts


> test:encoder
> node scripts/encode-payments.test.mjs


> test:contracts
> forge test

Compiling 2 files with Solc 0.8.24
Solc 0.8.24 finished in 585.12ms
Compiler run successful!

Ran 4 tests for test/ERC20BatchDistributor.t.sol:ERC20BatchDistributorTest
[PASS] testBatchTransfersPackedPayments() (gas: 66380)
[PASS] testOnlyRelayerCanSpendCustodiedFunds() (gas: 11507)
[PASS] testOwnerCanRecoverFunds() (gas: 40883)
[PASS] testRejectsUnalignedPaymentData() (gas: 10748)
Suite result: ok. 4 passed; 0 failed; 0 skipped; finished in 657.30µs (645.41µs CPU time)

Ran 1 test suite in 10.44ms (657.30µs CPU time): 4 tests passed, 0 failed, 0 skipped (4 total tests)
 M package.json
?? PLAN.md
?? foundry.toml
?? scripts/
?? src/
?? test/
 package.json | 8 +++++++-
 1 file changed, 7 insertions(+), 1 deletion(-)

diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..30793bf033189e62dca23082b79a2f304975323b
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,61 @@
+# Base relayer gas plan
+
+## What is known now
+
+There is no transaction export or sender implementation in this workspace, so an exact historical ETH total cannot be reconstructed here. Base fees have three parts: L2 execution, L1 data, and (where applicable) the OP Stack operator fee. The first is the only part represented by the usual `gasUsed * gasPrice` number. Do not report that number alone as the total cost.
+
+Use the last 7 days of relayer transactions to populate this calculation:
+
+```
+daily total ETH = sum(l2GasUsed * l2GasPriceWei + l1DataFeeWei + operatorFeeWei) / 1e18
+daily USD       = daily total ETH * ETH_USD
+```
+
+Until that export is available, this is the useful planning baseline. A normal ERC-20 `transfer` to an already-funded recipient is conservatively modelled at **51,000 L2 gas**. At 40,000 transfers/day that is **2,040,000,000 L2 gas/day** or **744.6 billion L2 gas/year**, before L1 data and operator fees. If the L2 gas price is `P` gwei, that component alone is `2.04 × P ETH/day` (for example, 0.00204 ETH/day at 0.001 gwei). Replace 51,000 and P with the p50/p95 from the export; recipient balances, token implementation, and calldata affect it a lot.
+
+## Ranked changes
+
+The order below is by recurring saving, not by implementation convenience. Numbers are L2 execution gas; L1-data savings are additional unless noted.
+
+| Rank | Change | Daily saving at 40k/day | Why / assumptions |
+| --- | --- | ---: | --- |
+| 1 (when eligible) | Keep internal payments in an off-chain balance ledger and settle only withdrawals | **51,000 gas for every avoided transfer**; maximum **2.04B gas/day (100%)** | This changes the product/custody model. If 60% of payments stay internal, the saving is 1.224B gas/day. Publish balances, define withdrawal SLAs, and obtain legal/compliance approval before doing it. |
+| 2 | Batch 100 payouts per token using the shipped distributor | about **808M gas/day (39.6%)**, plus L1-data savings | Conservative model: 100 singles = 5.10M gas; one packed batch = about 3.08M gas. The batch preserves one ERC-20 transfer per recipient, but removes 99 transaction envelopes and makes repeated token calls warm. 40,000 transactions become **400**. Estimate actual token/recipient samples before committing to the percentage. |
+| 3 | Net duplicate `(token, recipient)` payouts within each batch/window before batching | **about 30,800 gas per payout eliminated after batching** | At a 10% duplicate rate that is roughly **123M gas/day** beyond batching. It must preserve invoice-level accounting and only net payments with compatible availability requirements. |
+| 4 | Send only during acceptable Base fee windows, with a service-level deadline | variable; only the price spread, not gas units | This does not reduce gas use. Savings are `daily fee × (current price - chosen price) / current price`; it matters only for payments that may wait. Never strand payroll/refunds for a fee target. |
+
+The conditional upper bound in rank 1 is larger than batching, but batching is the largest unconditional on-chain saving and is ready to pilot now.
+
+## Shipped implementation: compact batch distributor
+
+`src/ERC20BatchDistributor.sol` is a dependency-free Solidity 0.8.24 contract. The existing relayer deploys it, transfers each token's working balance into it, then calls `batchTransfer`. Only that deployer can spend or recover the contract's balance. The packed payload is deliberately **52 bytes/payment**:
+
+```
+20-byte recipient address || 32-byte uint256 token amount
+```
+
+This is smaller than ABI `address[]` + `uint256[]` encoding (64 bytes/payment, plus array headers) and avoids per-payment storage. The contract accepts both standard ERC-20 `true` responses and legacy no-return tokens; it reverts the whole batch on a failed transfer, which is required to avoid partial payrolls.
+
+Create the payload from decimal base units (not display units):
+
+```
+node scripts/encode-payments.mjs payouts.json
+cast send "$BATCHER" 'batchTransfer(address,bytes)' "$TOKEN" "$(node scripts/encode-payments.mjs payouts.json)" --rpc-url "$BASE_RPC" --private-key "$RELAYER_KEY"
+```
+
+Example `payouts.json`:
+
+```json
+[{"recipient":"0x1111111111111111111111111111111111111111","amount":"1250000"}]
+```
+
+Use batches of 50–200 as a starting point (100 is the financial model above), grouped by token. Keep a small prefunded working balance; the top-up itself is a separate transfer, so do not fund once per batch. The relayer key is now also the custody key for this balance: use its production signing controls and monitor the distributor balance.
+
+## Rollout and measurement
+
+1. Export 7 days of successful relayer sends including transaction input, `gasUsed`, effective L2 gas price, L1 data fee, and operator fee. Separate each token and whether the recipient balance was zero before payment.
+2. On Base Sepolia, estimate and send representative batches of 1, 10, 50, 100, and 200 for every supported token. Compare their **all-in** fees with the same payouts sent individually. A token that charges transfer fees, rebases, pauses, blacklists, or has unusual return data needs explicit integration tests before inclusion.
+3. Deploy with the relayer as owner, verify the source, fund a capped float, and shadow-build batches for a day. Check totals, recipient/amount ordering, idempotency keys, and reconciliation before broadcasting.
+4. Canary one token at 50 payments/batch, then increase to 100 after a full reconciliation cycle. Record `payment_count`, all-in fee, gas/payment, and failed/retried batches. Roll back by stopping new calls and using the owner-only `withdraw` function to return the float.
+
+Run the included checks with `npm test`. They compile the contract and verify packed decoding, authorization, malformed data rejection, and recovery.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7adf701fd0ca76ccd6e11afa11817859a3f5ac50
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 1000000
+via_ir = true
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..912e1e44cc8334f19c06eff69919c5a3ea9b9683
--- a/package.json
+++ b/package.json
@@ -1,4 +1,10 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test:encoder": "node scripts/encode-payments.test.mjs",
+    "test:contracts": "forge test",
+    "test": "npm run test:encoder && npm run test:contracts"
+  }
 }
diff --git a/scripts/encode-payments.mjs b/scripts/encode-payments.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..71282a38c8c0b063b2d6100179d1bc1cd21ef125
--- /dev/null
+++ b/scripts/encode-payments.mjs
@@ -0,0 +1,46 @@
+#!/usr/bin/env node
+/*
+ * Convert a payout JSON array into the compact calldata used by
+ * ERC20BatchDistributor.batchTransfer(address,bytes).
+ *
+ * Input:  [{"recipient":"0x...20-byte address...", "amount":"1230000"}]
+ * Output: 0x{20-byte recipient}{32-byte uint256}...
+ */
+import { readFileSync } from "node:fs";
+
+const [inputFile] = process.argv.slice(2);
+if (!inputFile) {
+  console.error("Usage: node scripts/encode-payments.mjs payouts.json");
+  process.exit(1);
+}
+
+let payments;
+try {
+  payments = JSON.parse(readFileSync(inputFile, "utf8"));
+} catch (error) {
+  console.error(`Cannot read payout JSON: ${error.message}`);
+  process.exit(1);
+}
+
+if (!Array.isArray(payments) || payments.length === 0) {
+  console.error("Payout JSON must be a non-empty array.");
+  process.exit(1);
+}
+
+const encoded = payments.map((payment, index) => {
+  if (!payment || typeof payment.recipient !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(payment.recipient)) {
+    throw new Error(`Payment ${index}: recipient must be a 20-byte 0x address.`);
+  }
+  let amount;
+  try {
+    amount = BigInt(payment.amount);
+  } catch {
+    throw new Error(`Payment ${index}: amount must be an integer accepted by BigInt.`);
+  }
+  if (amount < 0n || amount >= (1n << 256n)) {
+    throw new Error(`Payment ${index}: amount is outside uint256.`);
+  }
+  return payment.recipient.slice(2).toLowerCase() + amount.toString(16).padStart(64, "0");
+});
+
+console.log(`0x${encoded.join("")}`);
diff --git a/scripts/encode-payments.test.mjs b/scripts/encode-payments.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..54f413595943b38b677e46fac306a17d25ec6cdd
--- /dev/null
+++ b/scripts/encode-payments.test.mjs
@@ -0,0 +1,16 @@
+import assert from "node:assert/strict";
+import { mkdtempSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { execFileSync } from "node:child_process";
+
+const directory = mkdtempSync(join(tmpdir(), "batch-payouts-"));
+const input = join(directory, "payouts.json");
+writeFileSync(input, JSON.stringify([
+  { recipient: "0x000000000000000000000000000000000000a11c", amount: "15" },
+  { recipient: "0x0000000000000000000000000000000000000b0b", amount: "0x10" },
+]));
+const output = execFileSync(process.execPath, ["scripts/encode-payments.mjs", input], { encoding: "utf8" }).trim();
+assert.equal(output.length, 2 + 2 * 52 * 2);
+assert.equal(output.slice(2, 42), "000000000000000000000000000000000000a11c");
+assert.equal(output.slice(-64), "10".padStart(64, "0"));
diff --git a/src/ERC20BatchDistributor.sol b/src/ERC20BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a7303836221167d9b2a00fcc66bdab76ab4d73b7
--- /dev/null
+++ b/src/ERC20BatchDistributor.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Sends balances held by this contract to many recipients in one transaction.
+/// @dev Only the immutable relayer/owner may execute or withdraw. Each payment is
+///      encoded as 20 bytes of recipient followed by 32 bytes of uint256 amount.
+contract ERC20BatchDistributor {
+    error Unauthorized();
+    error InvalidPaymentData();
+    error TokenHasNoCode();
+    error TokenTransferFailed();
+
+    uint256 private constant PAYMENT_SIZE = 52;
+    address public immutable owner;
+
+    event BatchTransferred(address indexed token, uint256 paymentCount);
+    event Withdrawn(address indexed token, address indexed recipient, uint256 amount);
+
+    constructor() {
+        owner = msg.sender;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    /// @notice Transfer a prefunded ERC-20 balance to each packed payment recipient.
+    /// @param token ERC-20 held by this contract.
+    /// @param payments Concatenated {address (20 bytes), amount (32 bytes)} records.
+    function batchTransfer(address token, bytes calldata payments) external onlyOwner {
+        uint256 length = payments.length;
+        if (length == 0 || length % PAYMENT_SIZE != 0) revert InvalidPaymentData();
+        if (token.code.length == 0) revert TokenHasNoCode();
+
+        for (uint256 offset; offset < length;) {
+            address recipient;
+            uint256 amount;
+            assembly ("memory-safe") {
+                recipient := shr(96, calldataload(add(payments.offset, offset)))
+                amount := calldataload(add(add(payments.offset, offset), 20))
+            }
+            _safeTransfer(token, recipient, amount);
+            unchecked {
+                offset += PAYMENT_SIZE;
+            }
+        }
+
+        emit BatchTransferred(token, length / PAYMENT_SIZE);
+    }
+
+    /// @notice Recover an ERC-20 balance. This is intentionally owner-only because
+    ///         this contract is a relayer-controlled custody address.
+    function withdraw(address token, address recipient, uint256 amount) external onlyOwner {
+        if (token.code.length == 0) revert TokenHasNoCode();
+        _safeTransfer(token, recipient, amount);
+        emit Withdrawn(token, recipient, amount);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount) private {
+        assembly ("memory-safe") {
+            let pointer := mload(0x40)
+            // transfer(address,uint256)
+            mstore(pointer, 0xa9059cbb00000000000000000000000000000000000000000000000000000000)
+            mstore(add(pointer, 4), recipient)
+            mstore(add(pointer, 36), amount)
+
+            let success := call(gas(), token, 0, pointer, 68, 0, 32)
+            let returnSize := returndatasize()
+            // Permit both standard `true` and legacy no-return ERC-20s.
+            let returnedTrue := and(iszero(lt(returnSize, 32)), eq(mload(0), 1))
+            if iszero(and(success, or(iszero(returnSize), returnedTrue))) {
+                mstore(0, 0x045c4b02) // TokenTransferFailed()
+                revert(28, 4)
+            }
+        }
+    }
+}
diff --git a/test/ERC20BatchDistributor.t.sol b/test/ERC20BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..22aac7736103251705e73b91f34223f4c74e0f12
--- /dev/null
+++ b/test/ERC20BatchDistributor.t.sol
@@ -0,0 +1,67 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {ERC20BatchDistributor} from "../src/ERC20BatchDistributor.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    function mint(address account, uint256 amount) external {
+        balanceOf[account] += amount;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        require(balanceOf[msg.sender] >= amount, "insufficient balance");
+        unchecked {
+            balanceOf[msg.sender] -= amount;
+            balanceOf[to] += amount;
+        }
+        return true;
+    }
+}
+
+contract ERC20BatchDistributorTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    ERC20BatchDistributor private distributor;
+    MockERC20 private token;
+    address private constant ALICE = address(0xA11CE);
+    address private constant BOB = address(0xB0B);
+    address private constant ATTACKER = address(0xBAD);
+
+    function setUp() public {
+        distributor = new ERC20BatchDistributor();
+        token = new MockERC20();
+        token.mint(address(distributor), 1_000 ether);
+    }
+
+    function testBatchTransfersPackedPayments() public {
+        bytes memory payments = abi.encodePacked(ALICE, uint256(123 ether), BOB, uint256(7 ether));
+        distributor.batchTransfer(address(token), payments);
+
+        require(token.balanceOf(ALICE) == 123 ether, "alice was not paid");
+        require(token.balanceOf(BOB) == 7 ether, "bob was not paid");
+        require(token.balanceOf(address(distributor)) == 870 ether, "wrong remaining balance");
+    }
+
+    function testRejectsUnalignedPaymentData() public {
+        vm.expectRevert(ERC20BatchDistributor.InvalidPaymentData.selector);
+        distributor.batchTransfer(address(token), hex"00");
+    }
+
+    function testOnlyRelayerCanSpendCustodiedFunds() public {
+        bytes memory payments = abi.encodePacked(ALICE, uint256(1 ether));
+        vm.prank(ATTACKER);
+        vm.expectRevert(ERC20BatchDistributor.Unauthorized.selector);
+        distributor.batchTransfer(address(token), payments);
+    }
+
+    function testOwnerCanRecoverFunds() public {
+        distributor.withdraw(address(token), ALICE, 10 ether);
+        require(token.balanceOf(ALICE) == 10 ether, "withdraw failed");
+    }
+}

codex
Implemented a shippable batching path and a ranked finance plan.

- [PLAN.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T000812Z-codex-no-skill-2/gas-goal-002/PLAN.md) quantifies the current modeled baseline: 2.04B L2 gas/day at 40k transfers, and estimates 100-payment batching saves ~808M gas/day (~39.6%), plus L1-data savings.
- [ERC20BatchDistributor.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T000812Z-codex-no-skill-2/gas-goal-002/src/ERC20BatchDistributor.sol) provides relayer-owner-only, prefunded ERC-20 batching using compact 52-byte payment records.
- [encode-payments.mjs](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T000812Z-codex-no-skill-2/gas-goal-002/scripts/encode-payments.mjs) creates the calldata from payout JSON.
- Added Foundry configuration and contract/encoder tests.

Verified with `npm test`: all 4 Solidity tests and the encoder test pass.
diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..30793bf033189e62dca23082b79a2f304975323b
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,61 @@
+# Base relayer gas plan
+
+## What is known now
+
+There is no transaction export or sender implementation in this workspace, so an exact historical ETH total cannot be reconstructed here. Base fees have three parts: L2 execution, L1 data, and (where applicable) the OP Stack operator fee. The first is the only part represented by the usual `gasUsed * gasPrice` number. Do not report that number alone as the total cost.
+
+Use the last 7 days of relayer transactions to populate this calculation:
+
+```
+daily total ETH = sum(l2GasUsed * l2GasPriceWei + l1DataFeeWei + operatorFeeWei) / 1e18
+daily USD       = daily total ETH * ETH_USD
+```
+
+Until that export is available, this is the useful planning baseline. A normal ERC-20 `transfer` to an already-funded recipient is conservatively modelled at **51,000 L2 gas**. At 40,000 transfers/day that is **2,040,000,000 L2 gas/day** or **744.6 billion L2 gas/year**, before L1 data and operator fees. If the L2 gas price is `P` gwei, that component alone is `2.04 × P ETH/day` (for example, 0.00204 ETH/day at 0.001 gwei). Replace 51,000 and P with the p50/p95 from the export; recipient balances, token implementation, and calldata affect it a lot.
+
+## Ranked changes
+
+The order below is by recurring saving, not by implementation convenience. Numbers are L2 execution gas; L1-data savings are additional unless noted.
+
+| Rank | Change | Daily saving at 40k/day | Why / assumptions |
+| --- | --- | ---: | --- |
+| 1 (when eligible) | Keep internal payments in an off-chain balance ledger and settle only withdrawals | **51,000 gas for every avoided transfer**; maximum **2.04B gas/day (100%)** | This changes the product/custody model. If 60% of payments stay internal, the saving is 1.224B gas/day. Publish balances, define withdrawal SLAs, and obtain legal/compliance approval before doing it. |
+| 2 | Batch 100 payouts per token using the shipped distributor | about **808M gas/day (39.6%)**, plus L1-data savings | Conservative model: 100 singles = 5.10M gas; one packed batch = about 3.08M gas. The batch preserves one ERC-20 transfer per recipient, but removes 99 transaction envelopes and makes repeated token calls warm. 40,000 transactions become **400**. Estimate actual token/recipient samples before committing to the percentage. |
+| 3 | Net duplicate `(token, recipient)` payouts within each batch/window before batching | **about 30,800 gas per payout eliminated after batching** | At a 10% duplicate rate that is roughly **123M gas/day** beyond batching. It must preserve invoice-level accounting and only net payments with compatible availability requirements. |
+| 4 | Send only during acceptable Base fee windows, with a service-level deadline | variable; only the price spread, not gas units | This does not reduce gas use. Savings are `daily fee × (current price - chosen price) / current price`; it matters only for payments that may wait. Never strand payroll/refunds for a fee target. |
+
+The conditional upper bound in rank 1 is larger than batching, but batching is the largest unconditional on-chain saving and is ready to pilot now.
+
+## Shipped implementation: compact batch distributor
+
+`src/ERC20BatchDistributor.sol` is a dependency-free Solidity 0.8.24 contract. The existing relayer deploys it, transfers each token's working balance into it, then calls `batchTransfer`. Only that deployer can spend or recover the contract's balance. The packed payload is deliberately **52 bytes/payment**:
+
+```
+20-byte recipient address || 32-byte uint256 token amount
+```
+
+This is smaller than ABI `address[]` + `uint256[]` encoding (64 bytes/payment, plus array headers) and avoids per-payment storage. The contract accepts both standard ERC-20 `true` responses and legacy no-return tokens; it reverts the whole batch on a failed transfer, which is required to avoid partial payrolls.
+
+Create the payload from decimal base units (not display units):
+
+```
+node scripts/encode-payments.mjs payouts.json
+cast send "$BATCHER" 'batchTransfer(address,bytes)' "$TOKEN" "$(node scripts/encode-payments.mjs payouts.json)" --rpc-url "$BASE_RPC" --private-key "$RELAYER_KEY"
+```
+
+Example `payouts.json`:
+
+```json
+[{"recipient":"0x1111111111111111111111111111111111111111","amount":"1250000"}]
+```
+
+Use batches of 50–200 as a starting point (100 is the financial model above), grouped by token. Keep a small prefunded working balance; the top-up itself is a separate transfer, so do not fund once per batch. The relayer key is now also the custody key for this balance: use its production signing controls and monitor the distributor balance.
+
+## Rollout and measurement
+
+1. Export 7 days of successful relayer sends including transaction input, `gasUsed`, effective L2 gas price, L1 data fee, and operator fee. Separate each token and whether the recipient balance was zero before payment.
+2. On Base Sepolia, estimate and send representative batches of 1, 10, 50, 100, and 200 for every supported token. Compare their **all-in** fees with the same payouts sent individually. A token that charges transfer fees, rebases, pauses, blacklists, or has unusual return data needs explicit integration tests before inclusion.
+3. Deploy with the relayer as owner, verify the source, fund a capped float, and shadow-build batches for a day. Check totals, recipient/amount ordering, idempotency keys, and reconciliation before broadcasting.
+4. Canary one token at 50 payments/batch, then increase to 100 after a full reconciliation cycle. Record `payment_count`, all-in fee, gas/payment, and failed/retried batches. Roll back by stopping new calls and using the owner-only `withdraw` function to return the float.
+
+Run the included checks with `npm test`. They compile the contract and verify packed decoding, authorization, malformed data rejection, and recovery.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..7adf701fd0ca76ccd6e11afa11817859a3f5ac50
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,8 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 1000000
+via_ir = true
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..912e1e44cc8334f19c06eff69919c5a3ea9b9683
--- a/package.json
+++ b/package.json
@@ -1,4 +1,10 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test:encoder": "node scripts/encode-payments.test.mjs",
+    "test:contracts": "forge test",
+    "test": "npm run test:encoder && npm run test:contracts"
+  }
 }
diff --git a/scripts/encode-payments.mjs b/scripts/encode-payments.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..71282a38c8c0b063b2d6100179d1bc1cd21ef125
--- /dev/null
+++ b/scripts/encode-payments.mjs
@@ -0,0 +1,46 @@
+#!/usr/bin/env node
+/*
+ * Convert a payout JSON array into the compact calldata used by
+ * ERC20BatchDistributor.batchTransfer(address,bytes).
+ *
+ * Input:  [{"recipient":"0x...20-byte address...", "amount":"1230000"}]
+ * Output: 0x{20-byte recipient}{32-byte uint256}...
+ */
+import { readFileSync } from "node:fs";
+
+const [inputFile] = process.argv.slice(2);
+if (!inputFile) {
+  console.error("Usage: node scripts/encode-payments.mjs payouts.json");
+  process.exit(1);
+}
+
+let payments;
+try {
+  payments = JSON.parse(readFileSync(inputFile, "utf8"));
+} catch (error) {
+  console.error(`Cannot read payout JSON: ${error.message}`);
+  process.exit(1);
+}
+
+if (!Array.isArray(payments) || payments.length === 0) {
+  console.error("Payout JSON must be a non-empty array.");
+  process.exit(1);
+}
+
+const encoded = payments.map((payment, index) => {
+  if (!payment || typeof payment.recipient !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(payment.recipient)) {
+    throw new Error(`Payment ${index}: recipient must be a 20-byte 0x address.`);
+  }
+  let amount;
+  try {
+    amount = BigInt(payment.amount);
+  } catch {
+    throw new Error(`Payment ${index}: amount must be an integer accepted by BigInt.`);
+  }
+  if (amount < 0n || amount >= (1n << 256n)) {
+    throw new Error(`Payment ${index}: amount is outside uint256.`);
+  }
+  return payment.recipient.slice(2).toLowerCase() + amount.toString(16).padStart(64, "0");
+});
+
+console.log(`0x${encoded.join("")}`);
diff --git a/scripts/encode-payments.test.mjs b/scripts/encode-payments.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..54f413595943b38b677e46fac306a17d25ec6cdd
--- /dev/null
+++ b/scripts/encode-payments.test.mjs
@@ -0,0 +1,16 @@
+import assert from "node:assert/strict";
+import { mkdtempSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { execFileSync } from "node:child_process";
+
+const directory = mkdtempSync(join(tmpdir(), "batch-payouts-"));
+const input = join(directory, "payouts.json");
+writeFileSync(input, JSON.stringify([
+  { recipient: "0x000000000000000000000000000000000000a11c", amount: "15" },
+  { recipient: "0x0000000000000000000000000000000000000b0b", amount: "0x10" },
+]));
+const output = execFileSync(process.execPath, ["scripts/encode-payments.mjs", input], { encoding: "utf8" }).trim();
+assert.equal(output.length, 2 + 2 * 52 * 2);
+assert.equal(output.slice(2, 42), "000000000000000000000000000000000000a11c");
+assert.equal(output.slice(-64), "10".padStart(64, "0"));
diff --git a/src/ERC20BatchDistributor.sol b/src/ERC20BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a7303836221167d9b2a00fcc66bdab76ab4d73b7
--- /dev/null
+++ b/src/ERC20BatchDistributor.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Sends balances held by this contract to many recipients in one transaction.
+/// @dev Only the immutable relayer/owner may execute or withdraw. Each payment is
+///      encoded as 20 bytes of recipient followed by 32 bytes of uint256 amount.
+contract ERC20BatchDistributor {
+    error Unauthorized();
+    error InvalidPaymentData();
+    error TokenHasNoCode();
+    error TokenTransferFailed();
+
+    uint256 private constant PAYMENT_SIZE = 52;
+    address public immutable owner;
+
+    event BatchTransferred(address indexed token, uint256 paymentCount);
+    event Withdrawn(address indexed token, address indexed recipient, uint256 amount);
+
+    constructor() {
+        owner = msg.sender;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    /// @notice Transfer a prefunded ERC-20 balance to each packed payment recipient.
+    /// @param token ERC-20 held by this contract.
+    /// @param payments Concatenated {address (20 bytes), amount (32 bytes)} records.
+    function batchTransfer(address token, bytes calldata payments) external onlyOwner {
+        uint256 length = payments.length;
+        if (length == 0 || length % PAYMENT_SIZE != 0) revert InvalidPaymentData();
+        if (token.code.length == 0) revert TokenHasNoCode();
+
+        for (uint256 offset; offset < length;) {
+            address recipient;
+            uint256 amount;
+            assembly ("memory-safe") {
+                recipient := shr(96, calldataload(add(payments.offset, offset)))
+                amount := calldataload(add(add(payments.offset, offset), 20))
+            }
+            _safeTransfer(token, recipient, amount);
+            unchecked {
+                offset += PAYMENT_SIZE;
+            }
+        }
+
+        emit BatchTransferred(token, length / PAYMENT_SIZE);
+    }
+
+    /// @notice Recover an ERC-20 balance. This is intentionally owner-only because
+    ///         this contract is a relayer-controlled custody address.
+    function withdraw(address token, address recipient, uint256 amount) external onlyOwner {
+        if (token.code.length == 0) revert TokenHasNoCode();
+        _safeTransfer(token, recipient, amount);
+        emit Withdrawn(token, recipient, amount);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount) private {
+        assembly ("memory-safe") {
+            let pointer := mload(0x40)
+            // transfer(address,uint256)
+            mstore(pointer, 0xa9059cbb00000000000000000000000000000000000000000000000000000000)
+            mstore(add(pointer, 4), recipient)
+            mstore(add(pointer, 36), amount)
+
+            let success := call(gas(), token, 0, pointer, 68, 0, 32)
+            let returnSize := returndatasize()
+            // Permit both standard `true` and legacy no-return ERC-20s.
+            let returnedTrue := and(iszero(lt(returnSize, 32)), eq(mload(0), 1))
+            if iszero(and(success, or(iszero(returnSize), returnedTrue))) {
+                mstore(0, 0x045c4b02) // TokenTransferFailed()
+                revert(28, 4)
+            }
+        }
+    }
+}
diff --git a/test/ERC20BatchDistributor.t.sol b/test/ERC20BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..22aac7736103251705e73b91f34223f4c74e0f12
--- /dev/null
+++ b/test/ERC20BatchDistributor.t.sol
@@ -0,0 +1,67 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {ERC20BatchDistributor} from "../src/ERC20BatchDistributor.sol";
+
+interface Vm {
+    function prank(address) external;
+    function expectRevert(bytes4) external;
+}
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    function mint(address account, uint256 amount) external {
+        balanceOf[account] += amount;
+    }
+
+    function transfer(address to, uint256 amount) external returns (bool) {
+        require(balanceOf[msg.sender] >= amount, "insufficient balance");
+        unchecked {
+            balanceOf[msg.sender] -= amount;
+            balanceOf[to] += amount;
+        }
+        return true;
+    }
+}
+
+contract ERC20BatchDistributorTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    ERC20BatchDistributor private distributor;
+    MockERC20 private token;
+    address private constant ALICE = address(0xA11CE);
+    address private constant BOB = address(0xB0B);
+    address private constant ATTACKER = address(0xBAD);
+
+    function setUp() public {
+        distributor = new ERC20BatchDistributor();
+        token = new MockERC20();
+        token.mint(address(distributor), 1_000 ether);
+    }
+
+    function testBatchTransfersPackedPayments() public {
+        bytes memory payments = abi.encodePacked(ALICE, uint256(123 ether), BOB, uint256(7 ether));
+        distributor.batchTransfer(address(token), payments);
+
+        require(token.balanceOf(ALICE) == 123 ether, "alice was not paid");
+        require(token.balanceOf(BOB) == 7 ether, "bob was not paid");
+        require(token.balanceOf(address(distributor)) == 870 ether, "wrong remaining balance");
+    }
+
+    function testRejectsUnalignedPaymentData() public {
+        vm.expectRevert(ERC20BatchDistributor.InvalidPaymentData.selector);
+        distributor.batchTransfer(address(token), hex"00");
+    }
+
+    function testOnlyRelayerCanSpendCustodiedFunds() public {
+        bytes memory payments = abi.encodePacked(ALICE, uint256(1 ether));
+        vm.prank(ATTACKER);
+        vm.expectRevert(ERC20BatchDistributor.Unauthorized.selector);
+        distributor.batchTransfer(address(token), payments);
+    }
+
+    function testOwnerCanRecoverFunds() public {
+        distributor.withdraw(address(token), ALICE, 10 ether);
+        require(token.balanceOf(ALICE) == 10 ether, "withdraw failed");
+    }
+}

tokens used
38,218
````

## final message

Implemented a shippable batching path and a ranked finance plan.

- [PLAN.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T000812Z-codex-no-skill-2/gas-goal-002/PLAN.md) quantifies the current modeled baseline: 2.04B L2 gas/day at 40k transfers, and estimates 100-payment batching saves ~808M gas/day (~39.6%), plus L1-data savings.
- [ERC20BatchDistributor.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T000812Z-codex-no-skill-2/gas-goal-002/src/ERC20BatchDistributor.sol) provides relayer-owner-only, prefunded ERC-20 batching using compact 52-byte payment records.
- [encode-payments.mjs](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T000812Z-codex-no-skill-2/gas-goal-002/scripts/encode-payments.mjs) creates the calldata from payout JSON.
- Added Foundry configuration and contract/encoder tests.

Verified with `npm test`: all 4 Solidity tests and the encoder test pass.
