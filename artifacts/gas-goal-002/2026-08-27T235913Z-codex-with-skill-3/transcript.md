# Executor transcript — 2026-08-27T235913Z-codex-with-skill-3

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a045a9-dc5e-7e12-a826-885910a7afe4
--------
user
We run a payments app on Base — about 40,000 ERC-20 transfers a day, all sent
from our own relayer wallet. Finance is asking what we actually spend on gas
and what we can do about it.

Work in this directory. Write me a plan in PLAN.md, ranked by what each change
actually saves, with the numbers behind it. Implement the parts that are code
so we can ship them.

2026-08-27T23:59:15.242027Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a045a9-dc5e-7e12-a826-885910a7afe4.tmp-1787875155046451934: line 2547: syntax error near unexpected token `('

codex
I’ll model the relayer’s current Base costs, rank concrete reductions by savings, and implement any repository changes that safely support them. I’m using the gas-cost guidance because the request depends on current fee mechanics and cost claims.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/gas/SKILL.md && printf '\\n--- files ---\\n' && rg --files -g '"'!*node_modules*'"' -g '"'!*.lock'"' | head -200" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
---
name: gas
description: Use when quoting a gas or dollar cost for a transaction or deployment, when cost is the reason to pick mainnet over an L2, when setting EIP-1559 fee fields or cutting L2 fees, or when calling Ethereum expensive or cheap. Not for non-cost chain selection (`l2s`).
---

# Gas and Chain Cost

Your trained gas-price and ETH-price priors are stale. Never quote a transaction cost or exclude a chain for cost reasons without measuring the relevant chain now.

```bash
# Mainnet
cast base-fee --rpc-url https://ethereum-rpc.publicnode.com
cast gas-price --rpc-url https://ethereum-rpc.publicnode.com

# Example L2; query the chain actually under consideration
cast base-fee --rpc-url https://mainnet.base.org
cast gas-price --rpc-url https://mainnet.base.org
```

If an endpoint fails, try another RPC. Do not replace a failed lookup with a remembered number. Fetch ETH/USD live before quoting dollars.

Estimate the actual operation when possible. Otherwise state and justify the gas-used assumption:

```text
cost_usd = gas_used × gas_price_gwei × 1e-9 × eth_usd
```

Choose from the measured workload:

- Keep mainnet viable for low-frequency, high-value actions unless another requirement favors an L2.
- Prefer an L2 for high-frequency, low-value, latency-sensitive, or L2-native activity.
- Do not choose an L2 merely because you remember mainnet gas being expensive.

Derive EIP-1559 fee fields from the target chain immediately before submission. Do not hardcode them or port a mainnet priority-fee constant to an L2.

For L2 optimization, inspect current receipts before deciding what dominates the fee. On OP-stack chains compare `gasUsed × effectiveGasPrice` with `l1Fee`; do not import a pre-Dencun calldata-cost assumption. Other rollup families use different fee models, so measure them independently.

--- files ---
TASK.md
package.json

exec
/bin/bash -lc "sed -n '1,260p' TASK.md; sed -n '1,240p' package.json; git status --short; find . -maxdepth 2 -type f -not -path './.git/*' -not -path './node_modules/*' | sort" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002
 succeeded in 1ms:
exec
/bin/bash -lc "command -v cast || true
cast gas-price --rpc-url https://mainnet.base.org
cast base-fee --rpc-url https://mainnet.base.org
curl -sS --max-time 15 'https://api.coinbase.com/v2/prices/ETH-USD/spot'" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002
 succeeded in 1461ms:
6000000
5000000
{"data":{"amount":"2511.39","base":"ETH","currency":"USD"}}
exec
/bin/bash -lc 'block=$(cast block-number --rpc-url https://mainnet.base.org); echo "$block"; cast logs --rpc-url https://mainnet.base.org --from-block "$block" --to-block "$block" '"'Transfer(address,address,uint256)' | sed -n '1,80p'" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002
 succeeded in 1194ms:
50542918
- address: 0xb4bB2032A73A53C0Aa7Dc9ee2d9658a978fA7bC2
  blockHash: 0x79140d7d4eccabf52710147b56cb1a62c65af426cd1753e54010cee21c1a214f
  blockNumber: 50542918
  data: 0x0000000000000000000000000000000000000000000000005ad80b33a590d800
  logIndex: 3
  removed: false
  topics: [
  	0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
  	0x00000000000000000000000058698b9de20c10600f3811db331d5b80b282dcef
  	0x000000000000000000000000bface6ad3c7f07714f2cc0a2651436f897537a95
  ]
  transactionHash: 0xc0a69cc9f67521ec2980f5e693de964de87d4b2986715af08531a197e6e393dd
  transactionIndex: 18
- address: 0x940181a94A35A4569E4529A3CDfB74e38FD98631
  blockHash: 0x79140d7d4eccabf52710147b56cb1a62c65af426cd1753e54010cee21c1a214f
  blockNumber: 50542918
  data: 0x000000000000000000000000000000000000000000000000023c3b9ade9a80d9
  logIndex: 11
  removed: false
  topics: [
  	0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
  	0x000000000000000000000000f33a96b5932d9e9b9a0eda447abd8c9d48d2e0c8
  	0x000000000000000000000000ddb9ba417506fe7528085a5c8445aea78e5b2e43
  ]
  transactionHash: 0xb6c3a2d11cdc700b149ec91dac967d704b28e76358f40bbc804d86d3536c91cf
  transactionIndex: 19
- address: 0x827922686190790b37229fd06084350E74485b72
  blockHash: 0x79140d7d4eccabf52710147b56cb1a62c65af426cd1753e54010cee21c1a214f
  blockNumber: 50542918
  data: 0x
  logIndex: 14
  removed: false
  topics: [
  	0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
  	0x000000000000000000000000f33a96b5932d9e9b9a0eda447abd8c9d48d2e0c8
  	0x000000000000000000000000ddb9ba417506fe7528085a5c8445aea78e5b2e43
  	0x00000000000000000000000000000000000000000000000000000000047c7adc
  ]
  transactionHash: 0xb6c3a2d11cdc700b149ec91dac967d704b28e76358f40bbc804d86d3536c91cf
  transactionIndex: 19
- address: 0x4200000000000000000000000000000000000006
  blockHash: 0x79140d7d4eccabf52710147b56cb1a62c65af426cd1753e54010cee21c1a214f
  blockNumber: 50542918
  data: 0x0000000000000000000000000000000000000000000000050a3edf61c6906235
  logIndex: 19
  removed: false
  topics: [
  	0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
  	0x000000000000000000000000b2cc224c1c9fee385f8ad6a55b4d94e92359dc59
  	0x000000000000000000000000ddb9ba417506fe7528085a5c8445aea78e5b2e43
  ]
  transactionHash: 0xb6c3a2d11cdc700b149ec91dac967d704b28e76358f40bbc804d86d3536c91cf
  transactionIndex: 19
- address: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
  blockHash: 0x79140d7d4eccabf52710147b56cb1a62c65af426cd1753e54010cee21c1a214f
  blockNumber: 50542918
  data: 0x000000000000000000000000000000000000000000000000000000606d8d70b8
  logIndex: 20
  removed: false
  topics: [
  	0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
  	0x000000000000000000000000b2cc224c1c9fee385f8ad6a55b4d94e92359dc59
  	0x000000000000000000000000ddb9ba417506fe7528085a5c8445aea78e5b2e43
  ]
  transactionHash: 0xb6c3a2d11cdc700b149ec91dac967d704b28e76358f40bbc804d86d3536c91cf
  transactionIndex: 19
- address: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
  blockHash: 0x79140d7d4eccabf52710147b56cb1a62c65af426cd1753e54010cee21c1a214f
  blockNumber: 50542918
  data: 0x00000000000000000000000000000000000000000000000000000000000007d0
  logIndex: 25
  removed: false
  topics: [
  	0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
  	0x00000000000000000000000041cdc787ab6a0ee5fae609ab085120477db4f3a5
  	0x000000000000000000000000a9dd7cc9cbf0e05551332209289f04be36bc2315
  ]
  transactionHash: 0xcf833f0d5ec28fee5e083c7e41ec2aa20b5f4c954e106e9bf70eea7c45c2b06b
  transactionIndex: 20
- address: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

exec
/bin/bash -lc 'for h in 0xc0a69cc9f67521ec2980f5e693de964de87d4b2986715af08531a197e6e393dd 0xcf833f0d5ec28fee5e083c7e41ec2aa20b5f4c954e106e9bf70eea7c45c2b06b; do cast tx "$h" --rpc-url https://mainnet.base.org | sed -n '"'1,80p'; done" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002
 succeeded in 1093ms:

blockHash            0x79140d7d4eccabf52710147b56cb1a62c65af426cd1753e54010cee21c1a214f
blockNumber          50542918
from                 0x467F3ACD346A3Aa56F612820367023B94dC73d3f
transactionIndex     18
effectiveGasPrice    7200000

gas                  520249
gasPrice             7200000
hash                 0xc0a69cc9f67521ec2980f5e693de964de87d4b2986715af08531a197e6e393dd
input                0xfe7cdd42a042e9fc24844f068a552af61e79b0aa00000000000000000000000000000000e81e4569a7064f87a3b89b9813c110a100000000000000000000000000000000436172642d44656269742d65504f530000000000000000000000000000000000455552000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004bc5d11259a2000000000000000000000000000058698b9de20c10600f3811db331d5b80b282dcef000000000000000000000000b4bb2032a73a53c0aa7dc9ee2d9658a978fa7bc20000000000000000000000000000000000000000000000005ad80b33a590d800000000000000000000000000000000000000000000000000000001a045aa4096
nonce                10705079
r                    0xa2ddfb477240934bb7fc17012a44b8de9d05f71e7ec1c555fb9c01a812f61379
s                    0x1766b33bb6177a39e1db1258630637df578e4a71e2a5e81430f1aafc561bf7d4
to                   0xFB384a73e9B89b01749C1127cDe4FeA20fb9F06a
type                 0
v                    1
value                0
            
blockTimestamp       1787875183


blockHash            0x79140d7d4eccabf52710147b56cb1a62c65af426cd1753e54010cee21c1a214f
blockNumber          50542918
from                 0x42dd53906B49c202E8E934b059dc019E04634b00
transactionIndex     20
effectiveGasPrice    6250005

accessList           []
chainId              8453
gasLimit             102001
hash                 0xcf833f0d5ec28fee5e083c7e41ec2aa20b5f4c954e106e9bf70eea7c45c2b06b
input                0xe3ee160e00000000000000000000000041cdc787ab6a0ee5fae609ab085120477db4f3a5000000000000000000000000a9dd7cc9cbf0e05551332209289f04be36bc231500000000000000000000000000000000000000000000000000000000000007d0000000000000000000000000000000000000000000000000000000006a90cd13000000000000000000000000000000000000000000000000000000006a90dd7bbac078c74fa776e3b7b4975155fb277ee6336d8f29f5308626030a6302bc23ae000000000000000000000000000000000000000000000000000000000000001b3b9a9a6fdcfa12a3478c130c7f228cc778621eca99241b370d90482c798c77003004df2ab07c57505ce9bc78f7ece552d27a39136232399fd09e924e882c919ca161776a6364705f666163696c31000e0280218021802180218021802180218021
maxFeePerGas         26250005
maxPriorityFeePerGas 1250005
nonce                1462177
r                    0x1c4dc3cd0b49f104ae74fc7a05e17cc08a86b83ffb920a3b6c1f8899e7de4ced
s                    0x4b9b894e738f17151b7665e684f50fae39203fbb16b6d6c87cfdee3eb2e756b1
to                   0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
type                 2
value                0
yParity              1
            
blockTimestamp       1787875183


exec
/bin/bash -lc "node -e 'const https=require(\"https\");const rpc=(method,params)=>new Promise((ok,no)=>{const r=https.request(\"https://mainnet.base.org\",{method:\"POST\",headers:{\"content-type\":\"application/json\"}},x=>{let b=\"\";x.on(\"data\",d=>b+=d);x.on(\"end\",()=>ok(JSON.parse(b).result))});r.on(\"error\",no);r.end(JSON.stringify({jsonrpc:\"2.0\",id:1,method,params}))});(async()=>{let n=await rpc(\"eth_blockNumber\",[]);let b=await rpc(\"eth_getBlockByNumber\",[n,true]);for(const t of b.transactions.filter(x=>x.input.startsWith(\"0xa9059cbb\")).slice(0,5)){let r=await rpc(\"eth_getTransactionReceipt\",[t.hash]); console.log(JSON.stringify({hash:t.hash,to:t.to,gasUsed:parseInt(r.gasUsed,16),effectiveGasPrice:parseInt(r.effectiveGasPrice,16),l1Fee:r.l1Fee?parseInt(r.l1Fee,16):null,l1GasUsed:r.l1GasUsed?parseInt(r.l1GasUsed,16):null}));}})().catch(console.error)'" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002
 succeeded in 1428ms:
{"hash":"0x0e4ffb9e73f39bb860ead1616795a8dc480ec8e856209034ceb97b462f863c4b","to":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","gasUsed":45047,"effectiveGasPrice":6000000,"l1Fee":462707932,"l1GasUsed":1600}
{"hash":"0x9a9db8e140f23d74def97c58d44aa531f6dd410945dcb83a60d9f26aa40315c0","to":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","gasUsed":45059,"effectiveGasPrice":6000000,"l1Fee":462707932,"l1GasUsed":1600}

codex
The live Base sample is strikingly low: two plain USDC transfers used ~45,050 execution gas at 0.006 gwei plus a 0.463 gwei L1 data fee—about $0.00000184 each, or roughly $2.21/month at 40,000/day. I’m treating batching as a measured, modest optimization here: it removes duplicated transaction overhead, but not most data availability cost.
exec
/bin/bash -lc 'command -v forge; forge --version; command -v solc || true; git log -1 --oneline; git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
/home/damu/.foundry/bin/forge
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf
/home/damu/.local/bin/solc
6d0ce19 eval baseline

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002/foundry.toml
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002/package.json
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002/scripts/base-fee-policy.mjs
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002/src/BatchPayer.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002/src/MockERC20.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002/test/BatchPayer.t.sol
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d49ff3bb1559f3ad4dc501e69e40b12b4b298640
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..032dae0ac8eae52f4a229c6453310db8fb2aeb96
--- a/package.json
+++ b/package.json
@@ -1,4 +1,8 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "scripts": {
+    "fees:base": "node scripts/base-fee-policy.mjs",
+    "test": "forge test"
+  }
 }
diff --git a/scripts/base-fee-policy.mjs b/scripts/base-fee-policy.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..aa802605fac580e50d13d3d50ba43238353bacbf
--- /dev/null
+++ b/scripts/base-fee-policy.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+
+// Gets current Base fee data at submission time. It intentionally does not use
+// a copied mainnet priority fee or a static gwei constant.
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const urgency = process.env.FEE_URGENCY ?? "standard";
+const percentile = { economical: 25, standard: 50, urgent: 90 }[urgency];
+if (percentile === undefined) throw new Error("FEE_URGENCY must be economical, standard, or urgent");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const [latest, history, suggestedGasPrice] = await Promise.all([
+  rpc("eth_getBlockByNumber", ["latest", false]),
+  rpc("eth_feeHistory", ["0x5", "latest", [percentile]]),
+  rpc("eth_gasPrice", []),
+]);
+const toBigInt = (hex) => BigInt(hex);
+const baseFee = toBigInt(latest.baseFeePerGas);
+const rewards = history.reward.map((row) => toBigInt(row[0]));
+const priorityFee = rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[Math.floor(rewards.length / 2)];
+// Two blocks of base-fee headroom avoids a replacement storm while retaining a
+// current-chain derived cap. Base may enforce a network minimum gas price, so
+// never set a cap below its current suggestion.
+const maxFeePerGas = [baseFee * 2n + priorityFee, toBigInt(suggestedGasPrice)].reduce((a, b) => a > b ? a : b);
+
+const asGwei = (value) => Number(value) / 1e9;
+console.log(JSON.stringify({
+  chainId: 8453,
+  sampledAt: new Date().toISOString(),
+  urgency,
+  baseFeePerGasWei: baseFee.toString(),
+  maxPriorityFeePerGasWei: priorityFee.toString(),
+  maxFeePerGasWei: maxFeePerGas.toString(),
+  suggestedGasPriceWei: suggestedGasPrice,
+  displayGwei: {
+    baseFee: asGwei(baseFee),
+    maxPriorityFee: asGwei(priorityFee),
+    maxFee: asGwei(maxFeePerGas),
+  },
+}, null, 2));
diff --git a/src/BatchPayer.sol b/src/BatchPayer.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f61adeab92414abbddee11967b9b01dc3e7bc94
--- /dev/null
+++ b/src/BatchPayer.sol
@@ -0,0 +1,72 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Holds payment tokens and distributes them in one transaction.
+/// @dev Fund this contract directly. Do not use `transferFrom` for every
+/// recipient: the allowance update and extra call remove much of the benefit.
+contract BatchPayer {
+    error Unauthorized();
+    error ReentrantCall();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error TokenTransferFailed(uint256 index);
+
+    uint256 public constant MAX_RECIPIENTS = 200;
+
+    address public immutable owner;
+    uint256 private locked = 1;
+
+    event BatchPaid(address indexed token, uint256 recipients, uint256 total);
+
+    constructor(address owner_) {
+        if (owner_ == address(0)) revert Unauthorized();
+        owner = owner_;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    /// @notice Pays every recipient from this contract's balance.
+    /// @dev Supports ERC-20s that either return true or return no value.
+    function pay(
+        address token,
+        address[] calldata recipients,
+        uint256[] calldata amounts
+    ) external onlyOwner nonReentrant {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_RECIPIENTS) revert BatchTooLarge();
+
+        uint256 total;
+        for (uint256 i; i < length; ++i) {
+            total += amounts[i];
+            _safeTransfer(token, recipients[i], amounts[i], i);
+        }
+        emit BatchPaid(token, length, total);
+    }
+
+    /// @notice Lets the owner recover a token after a failed or retired campaign.
+    function recover(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
+        _safeTransfer(token, recipient, amount, type(uint256).max);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount, uint256 index) private {
+        (bool ok, bytes memory result) = token.call(
+            abi.encodeWithSelector(0xa9059cbb, recipient, amount)
+        );
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
+            revert TokenTransferFailed(index);
+        }
+    }
+}
diff --git a/src/MockERC20.sol b/src/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb8a06b96f4fe162571487dcac3de39faff74b80
--- /dev/null
+++ b/src/MockERC20.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    constructor(address initialHolder, uint256 supply) {
+        balanceOf[initialHolder] = supply;
+    }
+
+    function transfer(address recipient, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[recipient] += amount;
+        return true;
+    }
+}
diff --git a/test/BatchPayer.t.sol b/test/BatchPayer.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e578ff5b997c0353e83756dbb6659e00d0e7f468
--- /dev/null
+++ b/test/BatchPayer.t.sol
@@ -0,0 +1,54 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {BatchPayer} from "../src/BatchPayer.sol";
+import {MockERC20} from "../src/MockERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+}
+
+contract BatchPayerTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant RECIPIENT_A = address(0xB0B);
+    address private constant RECIPIENT_B = address(0xCAro1);
+    address private constant RECIPIENT_C = address(0xD0D);
+
+    BatchPayer private payer;
+    MockERC20 private token;
+
+    function setUp() public {
+        payer = new BatchPayer(OWNER);
+        token = new MockERC20(address(payer), 1_000_000);
+    }
+
+    function testPaysBatch() public {
+        address[] memory recipients = new address[](3);
+        recipients[0] = RECIPIENT_A;
+        recipients[1] = RECIPIENT_B;
+        recipients[2] = RECIPIENT_C;
+        uint256[] memory amounts = new uint256[](3);
+        amounts[0] = 11;
+        amounts[1] = 22;
+        amounts[2] = 33;
+
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+
+        require(token.balanceOf(RECIPIENT_A) == 11, "recipient A not paid");
+        require(token.balanceOf(RECIPIENT_B) == 22, "recipient B not paid");
+        require(token.balanceOf(RECIPIENT_C) == 33, "recipient C not paid");
+    }
+
+    function testRejectsNonOwner() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = RECIPIENT_A;
+        uint256[] memory amounts = new uint256[](1);
+        amounts[0] = 1;
+        (bool ok,) = address(payer).call(
+            abi.encodeCall(BatchPayer.pay, (address(token), recipients, amounts))
+        );
+        require(!ok, "non-owner paid");
+    }
+}

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d49ff3bb1559f3ad4dc501e69e40b12b4b298640
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..032dae0ac8eae52f4a229c6453310db8fb2aeb96
--- a/package.json
+++ b/package.json
@@ -1,4 +1,8 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "scripts": {
+    "fees:base": "node scripts/base-fee-policy.mjs",
+    "test": "forge test"
+  }
 }
diff --git a/scripts/base-fee-policy.mjs b/scripts/base-fee-policy.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..aa802605fac580e50d13d3d50ba43238353bacbf
--- /dev/null
+++ b/scripts/base-fee-policy.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+
+// Gets current Base fee data at submission time. It intentionally does not use
+// a copied mainnet priority fee or a static gwei constant.
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const urgency = process.env.FEE_URGENCY ?? "standard";
+const percentile = { economical: 25, standard: 50, urgent: 90 }[urgency];
+if (percentile === undefined) throw new Error("FEE_URGENCY must be economical, standard, or urgent");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const [latest, history, suggestedGasPrice] = await Promise.all([
+  rpc("eth_getBlockByNumber", ["latest", false]),
+  rpc("eth_feeHistory", ["0x5", "latest", [percentile]]),
+  rpc("eth_gasPrice", []),
+]);
+const toBigInt = (hex) => BigInt(hex);
+const baseFee = toBigInt(latest.baseFeePerGas);
+const rewards = history.reward.map((row) => toBigInt(row[0]));
+const priorityFee = rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[Math.floor(rewards.length / 2)];
+// Two blocks of base-fee headroom avoids a replacement storm while retaining a
+// current-chain derived cap. Base may enforce a network minimum gas price, so
+// never set a cap below its current suggestion.
+const maxFeePerGas = [baseFee * 2n + priorityFee, toBigInt(suggestedGasPrice)].reduce((a, b) => a > b ? a : b);
+
+const asGwei = (value) => Number(value) / 1e9;
+console.log(JSON.stringify({
+  chainId: 8453,
+  sampledAt: new Date().toISOString(),
+  urgency,
+  baseFeePerGasWei: baseFee.toString(),
+  maxPriorityFeePerGasWei: priorityFee.toString(),
+  maxFeePerGasWei: maxFeePerGas.toString(),
+  suggestedGasPriceWei: suggestedGasPrice,
+  displayGwei: {
+    baseFee: asGwei(baseFee),
+    maxPriorityFee: asGwei(priorityFee),
+    maxFee: asGwei(maxFeePerGas),
+  },
+}, null, 2));
diff --git a/src/BatchPayer.sol b/src/BatchPayer.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f61adeab92414abbddee11967b9b01dc3e7bc94
--- /dev/null
+++ b/src/BatchPayer.sol
@@ -0,0 +1,72 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Holds payment tokens and distributes them in one transaction.
+/// @dev Fund this contract directly. Do not use `transferFrom` for every
+/// recipient: the allowance update and extra call remove much of the benefit.
+contract BatchPayer {
+    error Unauthorized();
+    error ReentrantCall();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error TokenTransferFailed(uint256 index);
+
+    uint256 public constant MAX_RECIPIENTS = 200;
+
+    address public immutable owner;
+    uint256 private locked = 1;
+
+    event BatchPaid(address indexed token, uint256 recipients, uint256 total);
+
+    constructor(address owner_) {
+        if (owner_ == address(0)) revert Unauthorized();
+        owner = owner_;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    /// @notice Pays every recipient from this contract's balance.
+    /// @dev Supports ERC-20s that either return true or return no value.
+    function pay(
+        address token,
+        address[] calldata recipients,
+        uint256[] calldata amounts
+    ) external onlyOwner nonReentrant {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_RECIPIENTS) revert BatchTooLarge();
+
+        uint256 total;
+        for (uint256 i; i < length; ++i) {
+            total += amounts[i];
+            _safeTransfer(token, recipients[i], amounts[i], i);
+        }
+        emit BatchPaid(token, length, total);
+    }
+
+    /// @notice Lets the owner recover a token after a failed or retired campaign.
+    function recover(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
+        _safeTransfer(token, recipient, amount, type(uint256).max);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount, uint256 index) private {
+        (bool ok, bytes memory result) = token.call(
+            abi.encodeWithSelector(0xa9059cbb, recipient, amount)
+        );
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
+            revert TokenTransferFailed(index);
+        }
+    }
+}
diff --git a/src/MockERC20.sol b/src/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb8a06b96f4fe162571487dcac3de39faff74b80
--- /dev/null
+++ b/src/MockERC20.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    constructor(address initialHolder, uint256 supply) {
+        balanceOf[initialHolder] = supply;
+    }
+
+    function transfer(address recipient, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[recipient] += amount;
+        return true;
+    }
+}
diff --git a/test/BatchPayer.t.sol b/test/BatchPayer.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e578ff5b997c0353e83756dbb6659e00d0e7f468
--- /dev/null
+++ b/test/BatchPayer.t.sol
@@ -0,0 +1,54 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {BatchPayer} from "../src/BatchPayer.sol";
+import {MockERC20} from "../src/MockERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+}
+
+contract BatchPayerTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant RECIPIENT_A = address(0xB0B);
+    address private constant RECIPIENT_B = address(0xCAro1);
+    address private constant RECIPIENT_C = address(0xD0D);
+
+    BatchPayer private payer;
+    MockERC20 private token;
+
+    function setUp() public {
+        payer = new BatchPayer(OWNER);
+        token = new MockERC20(address(payer), 1_000_000);
+    }
+
+    function testPaysBatch() public {
+        address[] memory recipients = new address[](3);
+        recipients[0] = RECIPIENT_A;
+        recipients[1] = RECIPIENT_B;
+        recipients[2] = RECIPIENT_C;
+        uint256[] memory amounts = new uint256[](3);
+        amounts[0] = 11;
+        amounts[1] = 22;
+        amounts[2] = 33;
+
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+
+        require(token.balanceOf(RECIPIENT_A) == 11, "recipient A not paid");
+        require(token.balanceOf(RECIPIENT_B) == 22, "recipient B not paid");
+        require(token.balanceOf(RECIPIENT_C) == 33, "recipient C not paid");
+    }
+
+    function testRejectsNonOwner() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = RECIPIENT_A;
+        uint256[] memory amounts = new uint256[](1);
+        amounts[0] = 1;
+        (bool ok,) = address(payer).call(
+            abi.encodeCall(BatchPayer.pay, (address(token), recipients, amounts))
+        );
+        require(!ok, "non-owner paid");
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002/test/BatchPayer.t.sol
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d49ff3bb1559f3ad4dc501e69e40b12b4b298640
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..032dae0ac8eae52f4a229c6453310db8fb2aeb96
--- a/package.json
+++ b/package.json
@@ -1,4 +1,8 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "scripts": {
+    "fees:base": "node scripts/base-fee-policy.mjs",
+    "test": "forge test"
+  }
 }
diff --git a/scripts/base-fee-policy.mjs b/scripts/base-fee-policy.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..aa802605fac580e50d13d3d50ba43238353bacbf
--- /dev/null
+++ b/scripts/base-fee-policy.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+
+// Gets current Base fee data at submission time. It intentionally does not use
+// a copied mainnet priority fee or a static gwei constant.
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const urgency = process.env.FEE_URGENCY ?? "standard";
+const percentile = { economical: 25, standard: 50, urgent: 90 }[urgency];
+if (percentile === undefined) throw new Error("FEE_URGENCY must be economical, standard, or urgent");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const [latest, history, suggestedGasPrice] = await Promise.all([
+  rpc("eth_getBlockByNumber", ["latest", false]),
+  rpc("eth_feeHistory", ["0x5", "latest", [percentile]]),
+  rpc("eth_gasPrice", []),
+]);
+const toBigInt = (hex) => BigInt(hex);
+const baseFee = toBigInt(latest.baseFeePerGas);
+const rewards = history.reward.map((row) => toBigInt(row[0]));
+const priorityFee = rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[Math.floor(rewards.length / 2)];
+// Two blocks of base-fee headroom avoids a replacement storm while retaining a
+// current-chain derived cap. Base may enforce a network minimum gas price, so
+// never set a cap below its current suggestion.
+const maxFeePerGas = [baseFee * 2n + priorityFee, toBigInt(suggestedGasPrice)].reduce((a, b) => a > b ? a : b);
+
+const asGwei = (value) => Number(value) / 1e9;
+console.log(JSON.stringify({
+  chainId: 8453,
+  sampledAt: new Date().toISOString(),
+  urgency,
+  baseFeePerGasWei: baseFee.toString(),
+  maxPriorityFeePerGasWei: priorityFee.toString(),
+  maxFeePerGasWei: maxFeePerGas.toString(),
+  suggestedGasPriceWei: suggestedGasPrice,
+  displayGwei: {
+    baseFee: asGwei(baseFee),
+    maxPriorityFee: asGwei(priorityFee),
+    maxFee: asGwei(maxFeePerGas),
+  },
+}, null, 2));
diff --git a/src/BatchPayer.sol b/src/BatchPayer.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f61adeab92414abbddee11967b9b01dc3e7bc94
--- /dev/null
+++ b/src/BatchPayer.sol
@@ -0,0 +1,72 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Holds payment tokens and distributes them in one transaction.
+/// @dev Fund this contract directly. Do not use `transferFrom` for every
+/// recipient: the allowance update and extra call remove much of the benefit.
+contract BatchPayer {
+    error Unauthorized();
+    error ReentrantCall();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error TokenTransferFailed(uint256 index);
+
+    uint256 public constant MAX_RECIPIENTS = 200;
+
+    address public immutable owner;
+    uint256 private locked = 1;
+
+    event BatchPaid(address indexed token, uint256 recipients, uint256 total);
+
+    constructor(address owner_) {
+        if (owner_ == address(0)) revert Unauthorized();
+        owner = owner_;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    /// @notice Pays every recipient from this contract's balance.
+    /// @dev Supports ERC-20s that either return true or return no value.
+    function pay(
+        address token,
+        address[] calldata recipients,
+        uint256[] calldata amounts
+    ) external onlyOwner nonReentrant {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_RECIPIENTS) revert BatchTooLarge();
+
+        uint256 total;
+        for (uint256 i; i < length; ++i) {
+            total += amounts[i];
+            _safeTransfer(token, recipients[i], amounts[i], i);
+        }
+        emit BatchPaid(token, length, total);
+    }
+
+    /// @notice Lets the owner recover a token after a failed or retired campaign.
+    function recover(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
+        _safeTransfer(token, recipient, amount, type(uint256).max);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount, uint256 index) private {
+        (bool ok, bytes memory result) = token.call(
+            abi.encodeWithSelector(0xa9059cbb, recipient, amount)
+        );
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
+            revert TokenTransferFailed(index);
+        }
+    }
+}
diff --git a/src/MockERC20.sol b/src/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb8a06b96f4fe162571487dcac3de39faff74b80
--- /dev/null
+++ b/src/MockERC20.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    constructor(address initialHolder, uint256 supply) {
+        balanceOf[initialHolder] = supply;
+    }
+
+    function transfer(address recipient, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[recipient] += amount;
+        return true;
+    }
+}
diff --git a/test/BatchPayer.t.sol b/test/BatchPayer.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3421eaed56e7cfbcc6bab2d55ce62f6cc6c6fef3
--- /dev/null
+++ b/test/BatchPayer.t.sol
@@ -0,0 +1,54 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {BatchPayer} from "../src/BatchPayer.sol";
+import {MockERC20} from "../src/MockERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+}
+
+contract BatchPayerTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant RECIPIENT_A = address(0xB0B);
+    address private constant RECIPIENT_B = address(0xCA01);
+    address private constant RECIPIENT_C = address(0xD0D);
+
+    BatchPayer private payer;
+    MockERC20 private token;
+
+    function setUp() public {
+        payer = new BatchPayer(OWNER);
+        token = new MockERC20(address(payer), 1_000_000);
+    }
+
+    function testPaysBatch() public {
+        address[] memory recipients = new address[](3);
+        recipients[0] = RECIPIENT_A;
+        recipients[1] = RECIPIENT_B;
+        recipients[2] = RECIPIENT_C;
+        uint256[] memory amounts = new uint256[](3);
+        amounts[0] = 11;
+        amounts[1] = 22;
+        amounts[2] = 33;
+
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+
+        require(token.balanceOf(RECIPIENT_A) == 11, "recipient A not paid");
+        require(token.balanceOf(RECIPIENT_B) == 22, "recipient B not paid");
+        require(token.balanceOf(RECIPIENT_C) == 33, "recipient C not paid");
+    }
+
+    function testRejectsNonOwner() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = RECIPIENT_A;
+        uint256[] memory amounts = new uint256[](1);
+        amounts[0] = 1;
+        (bool ok,) = address(payer).call(
+            abi.encodeCall(BatchPayer.pay, (address(token), recipients, amounts))
+        );
+        require(!ok, "non-owner paid");
+    }
+}

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d49ff3bb1559f3ad4dc501e69e40b12b4b298640
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..032dae0ac8eae52f4a229c6453310db8fb2aeb96
--- a/package.json
+++ b/package.json
@@ -1,4 +1,8 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "scripts": {
+    "fees:base": "node scripts/base-fee-policy.mjs",
+    "test": "forge test"
+  }
 }
diff --git a/scripts/base-fee-policy.mjs b/scripts/base-fee-policy.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..aa802605fac580e50d13d3d50ba43238353bacbf
--- /dev/null
+++ b/scripts/base-fee-policy.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+
+// Gets current Base fee data at submission time. It intentionally does not use
+// a copied mainnet priority fee or a static gwei constant.
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const urgency = process.env.FEE_URGENCY ?? "standard";
+const percentile = { economical: 25, standard: 50, urgent: 90 }[urgency];
+if (percentile === undefined) throw new Error("FEE_URGENCY must be economical, standard, or urgent");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const [latest, history, suggestedGasPrice] = await Promise.all([
+  rpc("eth_getBlockByNumber", ["latest", false]),
+  rpc("eth_feeHistory", ["0x5", "latest", [percentile]]),
+  rpc("eth_gasPrice", []),
+]);
+const toBigInt = (hex) => BigInt(hex);
+const baseFee = toBigInt(latest.baseFeePerGas);
+const rewards = history.reward.map((row) => toBigInt(row[0]));
+const priorityFee = rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[Math.floor(rewards.length / 2)];
+// Two blocks of base-fee headroom avoids a replacement storm while retaining a
+// current-chain derived cap. Base may enforce a network minimum gas price, so
+// never set a cap below its current suggestion.
+const maxFeePerGas = [baseFee * 2n + priorityFee, toBigInt(suggestedGasPrice)].reduce((a, b) => a > b ? a : b);
+
+const asGwei = (value) => Number(value) / 1e9;
+console.log(JSON.stringify({
+  chainId: 8453,
+  sampledAt: new Date().toISOString(),
+  urgency,
+  baseFeePerGasWei: baseFee.toString(),
+  maxPriorityFeePerGasWei: priorityFee.toString(),
+  maxFeePerGasWei: maxFeePerGas.toString(),
+  suggestedGasPriceWei: suggestedGasPrice,
+  displayGwei: {
+    baseFee: asGwei(baseFee),
+    maxPriorityFee: asGwei(priorityFee),
+    maxFee: asGwei(maxFeePerGas),
+  },
+}, null, 2));
diff --git a/src/BatchPayer.sol b/src/BatchPayer.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f61adeab92414abbddee11967b9b01dc3e7bc94
--- /dev/null
+++ b/src/BatchPayer.sol
@@ -0,0 +1,72 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Holds payment tokens and distributes them in one transaction.
+/// @dev Fund this contract directly. Do not use `transferFrom` for every
+/// recipient: the allowance update and extra call remove much of the benefit.
+contract BatchPayer {
+    error Unauthorized();
+    error ReentrantCall();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error TokenTransferFailed(uint256 index);
+
+    uint256 public constant MAX_RECIPIENTS = 200;
+
+    address public immutable owner;
+    uint256 private locked = 1;
+
+    event BatchPaid(address indexed token, uint256 recipients, uint256 total);
+
+    constructor(address owner_) {
+        if (owner_ == address(0)) revert Unauthorized();
+        owner = owner_;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    /// @notice Pays every recipient from this contract's balance.
+    /// @dev Supports ERC-20s that either return true or return no value.
+    function pay(
+        address token,
+        address[] calldata recipients,
+        uint256[] calldata amounts
+    ) external onlyOwner nonReentrant {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_RECIPIENTS) revert BatchTooLarge();
+
+        uint256 total;
+        for (uint256 i; i < length; ++i) {
+            total += amounts[i];
+            _safeTransfer(token, recipients[i], amounts[i], i);
+        }
+        emit BatchPaid(token, length, total);
+    }
+
+    /// @notice Lets the owner recover a token after a failed or retired campaign.
+    function recover(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
+        _safeTransfer(token, recipient, amount, type(uint256).max);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount, uint256 index) private {
+        (bool ok, bytes memory result) = token.call(
+            abi.encodeWithSelector(0xa9059cbb, recipient, amount)
+        );
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
+            revert TokenTransferFailed(index);
+        }
+    }
+}
diff --git a/src/MockERC20.sol b/src/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb8a06b96f4fe162571487dcac3de39faff74b80
--- /dev/null
+++ b/src/MockERC20.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    constructor(address initialHolder, uint256 supply) {
+        balanceOf[initialHolder] = supply;
+    }
+
+    function transfer(address recipient, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[recipient] += amount;
+        return true;
+    }
+}
diff --git a/test/BatchPayer.t.sol b/test/BatchPayer.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3421eaed56e7cfbcc6bab2d55ce62f6cc6c6fef3
--- /dev/null
+++ b/test/BatchPayer.t.sol
@@ -0,0 +1,54 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {BatchPayer} from "../src/BatchPayer.sol";
+import {MockERC20} from "../src/MockERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+}
+
+contract BatchPayerTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant RECIPIENT_A = address(0xB0B);
+    address private constant RECIPIENT_B = address(0xCA01);
+    address private constant RECIPIENT_C = address(0xD0D);
+
+    BatchPayer private payer;
+    MockERC20 private token;
+
+    function setUp() public {
+        payer = new BatchPayer(OWNER);
+        token = new MockERC20(address(payer), 1_000_000);
+    }
+
+    function testPaysBatch() public {
+        address[] memory recipients = new address[](3);
+        recipients[0] = RECIPIENT_A;
+        recipients[1] = RECIPIENT_B;
+        recipients[2] = RECIPIENT_C;
+        uint256[] memory amounts = new uint256[](3);
+        amounts[0] = 11;
+        amounts[1] = 22;
+        amounts[2] = 33;
+
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+
+        require(token.balanceOf(RECIPIENT_A) == 11, "recipient A not paid");
+        require(token.balanceOf(RECIPIENT_B) == 22, "recipient B not paid");
+        require(token.balanceOf(RECIPIENT_C) == 33, "recipient C not paid");
+    }
+
+    function testRejectsNonOwner() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = RECIPIENT_A;
+        uint256[] memory amounts = new uint256[](1);
+        amounts[0] = 1;
+        (bool ok,) = address(payer).call(
+            abi.encodeCall(BatchPayer.pay, (address(token), recipients, amounts))
+        );
+        require(!ok, "non-owner paid");
+    }
+}

exec
/bin/bash -lc 'forge test --gas-report && node scripts/base-fee-policy.mjs && git diff --check && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002
 succeeded in 984ms:
Compiling 3 files with Solc 0.8.24
Solc 0.8.24 finished in 128.81ms
Compiler run successful!

Ran 2 tests for test/BatchPayer.t.sol:BatchPayerTest
[PASS] testPaysBatch() (gas: 135622)
[PASS] testRejectsNonOwner() (gas: 32011)
Suite result: ok. 2 passed; 0 failed; 0 skipped; finished in 554.46µs (391.32µs CPU time)

╭----------------------------------------+-----------------+-------+--------+--------+---------╮
| src/BatchPayer.sol:BatchPayer Contract |                 |       |        |        |         |
+==============================================================================================+
| Deployment Cost                        | Deployment Size |       |        |        |         |
|----------------------------------------+-----------------+-------+--------+--------+---------|
| 403447                                 | 1727            |       |        |        |         |
|----------------------------------------+-----------------+-------+--------+--------+---------|
|                                        |                 |       |        |        |         |
|----------------------------------------+-----------------+-------+--------+--------+---------|
| Function Name                          | Min             | Avg   | Median | Max    | # Calls |
|----------------------------------------+-----------------+-------+--------+--------+---------|
| pay                                    | 23179           | 66030 | 66030  | 108881 | 2       |
╰----------------------------------------+-----------------+-------+--------+--------+---------╯

╭--------------------------------------+-----------------+------+--------+------+---------╮
| src/MockERC20.sol:MockERC20 Contract |                 |      |        |      |         |
+=========================================================================================+
| Deployment Cost                      | Deployment Size |      |        |      |         |
|--------------------------------------+-----------------+------+--------+------+---------|
| 173983                               | 652             |      |        |      |         |
|--------------------------------------+-----------------+------+--------+------+---------|
|                                      |                 |      |        |      |         |
|--------------------------------------+-----------------+------+--------+------+---------|
| Function Name                        | Min             | Avg  | Median | Max  | # Calls |
|--------------------------------------+-----------------+------+--------+------+---------|
| balanceOf                            | 2486            | 2486 | 2486   | 2486 | 3       |
╰--------------------------------------+-----------------+------+--------+------+---------╯


Ran 1 test suite in 8.39ms (554.46µs CPU time): 2 tests passed, 0 failed, 0 skipped (2 total tests)
{
  "chainId": 8453,
  "sampledAt": "2026-08-28T00:01:24.525Z",
  "urgency": "standard",
  "baseFeePerGasWei": "5000000",
  "maxPriorityFeePerGasWei": "1000000",
  "maxFeePerGasWei": "11000000",
  "suggestedGasPriceWei": "0x5b8d80",
  "displayGwei": {
    "baseFee": 0.005,
    "maxPriorityFee": 0.001,
    "maxFee": 0.011
  }
}
 M package.json
?? foundry.toml
?? scripts/
?? src/
?? test/

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d49ff3bb1559f3ad4dc501e69e40b12b4b298640
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..032dae0ac8eae52f4a229c6453310db8fb2aeb96
--- a/package.json
+++ b/package.json
@@ -1,4 +1,8 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "scripts": {
+    "fees:base": "node scripts/base-fee-policy.mjs",
+    "test": "forge test"
+  }
 }
diff --git a/scripts/base-fee-policy.mjs b/scripts/base-fee-policy.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..aa802605fac580e50d13d3d50ba43238353bacbf
--- /dev/null
+++ b/scripts/base-fee-policy.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+
+// Gets current Base fee data at submission time. It intentionally does not use
+// a copied mainnet priority fee or a static gwei constant.
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const urgency = process.env.FEE_URGENCY ?? "standard";
+const percentile = { economical: 25, standard: 50, urgent: 90 }[urgency];
+if (percentile === undefined) throw new Error("FEE_URGENCY must be economical, standard, or urgent");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const [latest, history, suggestedGasPrice] = await Promise.all([
+  rpc("eth_getBlockByNumber", ["latest", false]),
+  rpc("eth_feeHistory", ["0x5", "latest", [percentile]]),
+  rpc("eth_gasPrice", []),
+]);
+const toBigInt = (hex) => BigInt(hex);
+const baseFee = toBigInt(latest.baseFeePerGas);
+const rewards = history.reward.map((row) => toBigInt(row[0]));
+const priorityFee = rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[Math.floor(rewards.length / 2)];
+// Two blocks of base-fee headroom avoids a replacement storm while retaining a
+// current-chain derived cap. Base may enforce a network minimum gas price, so
+// never set a cap below its current suggestion.
+const maxFeePerGas = [baseFee * 2n + priorityFee, toBigInt(suggestedGasPrice)].reduce((a, b) => a > b ? a : b);
+
+const asGwei = (value) => Number(value) / 1e9;
+console.log(JSON.stringify({
+  chainId: 8453,
+  sampledAt: new Date().toISOString(),
+  urgency,
+  baseFeePerGasWei: baseFee.toString(),
+  maxPriorityFeePerGasWei: priorityFee.toString(),
+  maxFeePerGasWei: maxFeePerGas.toString(),
+  suggestedGasPriceWei: suggestedGasPrice,
+  displayGwei: {
+    baseFee: asGwei(baseFee),
+    maxPriorityFee: asGwei(priorityFee),
+    maxFee: asGwei(maxFeePerGas),
+  },
+}, null, 2));
diff --git a/src/BatchPayer.sol b/src/BatchPayer.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f61adeab92414abbddee11967b9b01dc3e7bc94
--- /dev/null
+++ b/src/BatchPayer.sol
@@ -0,0 +1,72 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Holds payment tokens and distributes them in one transaction.
+/// @dev Fund this contract directly. Do not use `transferFrom` for every
+/// recipient: the allowance update and extra call remove much of the benefit.
+contract BatchPayer {
+    error Unauthorized();
+    error ReentrantCall();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error TokenTransferFailed(uint256 index);
+
+    uint256 public constant MAX_RECIPIENTS = 200;
+
+    address public immutable owner;
+    uint256 private locked = 1;
+
+    event BatchPaid(address indexed token, uint256 recipients, uint256 total);
+
+    constructor(address owner_) {
+        if (owner_ == address(0)) revert Unauthorized();
+        owner = owner_;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    /// @notice Pays every recipient from this contract's balance.
+    /// @dev Supports ERC-20s that either return true or return no value.
+    function pay(
+        address token,
+        address[] calldata recipients,
+        uint256[] calldata amounts
+    ) external onlyOwner nonReentrant {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_RECIPIENTS) revert BatchTooLarge();
+
+        uint256 total;
+        for (uint256 i; i < length; ++i) {
+            total += amounts[i];
+            _safeTransfer(token, recipients[i], amounts[i], i);
+        }
+        emit BatchPaid(token, length, total);
+    }
+
+    /// @notice Lets the owner recover a token after a failed or retired campaign.
+    function recover(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
+        _safeTransfer(token, recipient, amount, type(uint256).max);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount, uint256 index) private {
+        (bool ok, bytes memory result) = token.call(
+            abi.encodeWithSelector(0xa9059cbb, recipient, amount)
+        );
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
+            revert TokenTransferFailed(index);
+        }
+    }
+}
diff --git a/src/MockERC20.sol b/src/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb8a06b96f4fe162571487dcac3de39faff74b80
--- /dev/null
+++ b/src/MockERC20.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    constructor(address initialHolder, uint256 supply) {
+        balanceOf[initialHolder] = supply;
+    }
+
+    function transfer(address recipient, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[recipient] += amount;
+        return true;
+    }
+}
diff --git a/test/BatchPayer.t.sol b/test/BatchPayer.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..3421eaed56e7cfbcc6bab2d55ce62f6cc6c6fef3
--- /dev/null
+++ b/test/BatchPayer.t.sol
@@ -0,0 +1,54 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {BatchPayer} from "../src/BatchPayer.sol";
+import {MockERC20} from "../src/MockERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+}
+
+contract BatchPayerTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant RECIPIENT_A = address(0xB0B);
+    address private constant RECIPIENT_B = address(0xCA01);
+    address private constant RECIPIENT_C = address(0xD0D);
+
+    BatchPayer private payer;
+    MockERC20 private token;
+
+    function setUp() public {
+        payer = new BatchPayer(OWNER);
+        token = new MockERC20(address(payer), 1_000_000);
+    }
+
+    function testPaysBatch() public {
+        address[] memory recipients = new address[](3);
+        recipients[0] = RECIPIENT_A;
+        recipients[1] = RECIPIENT_B;
+        recipients[2] = RECIPIENT_C;
+        uint256[] memory amounts = new uint256[](3);
+        amounts[0] = 11;
+        amounts[1] = 22;
+        amounts[2] = 33;
+
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+
+        require(token.balanceOf(RECIPIENT_A) == 11, "recipient A not paid");
+        require(token.balanceOf(RECIPIENT_B) == 22, "recipient B not paid");
+        require(token.balanceOf(RECIPIENT_C) == 33, "recipient C not paid");
+    }
+
+    function testRejectsNonOwner() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = RECIPIENT_A;
+        uint256[] memory amounts = new uint256[](1);
+        amounts[0] = 1;
+        (bool ok,) = address(payer).call(
+            abi.encodeCall(BatchPayer.pay, (address(token), recipients, amounts))
+        );
+        require(!ok, "non-owner paid");
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002/test/BatchPayer.t.sol
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d49ff3bb1559f3ad4dc501e69e40b12b4b298640
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..032dae0ac8eae52f4a229c6453310db8fb2aeb96
--- a/package.json
+++ b/package.json
@@ -1,4 +1,8 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "scripts": {
+    "fees:base": "node scripts/base-fee-policy.mjs",
+    "test": "forge test"
+  }
 }
diff --git a/scripts/base-fee-policy.mjs b/scripts/base-fee-policy.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..aa802605fac580e50d13d3d50ba43238353bacbf
--- /dev/null
+++ b/scripts/base-fee-policy.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+
+// Gets current Base fee data at submission time. It intentionally does not use
+// a copied mainnet priority fee or a static gwei constant.
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const urgency = process.env.FEE_URGENCY ?? "standard";
+const percentile = { economical: 25, standard: 50, urgent: 90 }[urgency];
+if (percentile === undefined) throw new Error("FEE_URGENCY must be economical, standard, or urgent");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const [latest, history, suggestedGasPrice] = await Promise.all([
+  rpc("eth_getBlockByNumber", ["latest", false]),
+  rpc("eth_feeHistory", ["0x5", "latest", [percentile]]),
+  rpc("eth_gasPrice", []),
+]);
+const toBigInt = (hex) => BigInt(hex);
+const baseFee = toBigInt(latest.baseFeePerGas);
+const rewards = history.reward.map((row) => toBigInt(row[0]));
+const priorityFee = rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[Math.floor(rewards.length / 2)];
+// Two blocks of base-fee headroom avoids a replacement storm while retaining a
+// current-chain derived cap. Base may enforce a network minimum gas price, so
+// never set a cap below its current suggestion.
+const maxFeePerGas = [baseFee * 2n + priorityFee, toBigInt(suggestedGasPrice)].reduce((a, b) => a > b ? a : b);
+
+const asGwei = (value) => Number(value) / 1e9;
+console.log(JSON.stringify({
+  chainId: 8453,
+  sampledAt: new Date().toISOString(),
+  urgency,
+  baseFeePerGasWei: baseFee.toString(),
+  maxPriorityFeePerGasWei: priorityFee.toString(),
+  maxFeePerGasWei: maxFeePerGas.toString(),
+  suggestedGasPriceWei: suggestedGasPrice,
+  displayGwei: {
+    baseFee: asGwei(baseFee),
+    maxPriorityFee: asGwei(priorityFee),
+    maxFee: asGwei(maxFeePerGas),
+  },
+}, null, 2));
diff --git a/src/BatchPayer.sol b/src/BatchPayer.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f61adeab92414abbddee11967b9b01dc3e7bc94
--- /dev/null
+++ b/src/BatchPayer.sol
@@ -0,0 +1,72 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Holds payment tokens and distributes them in one transaction.
+/// @dev Fund this contract directly. Do not use `transferFrom` for every
+/// recipient: the allowance update and extra call remove much of the benefit.
+contract BatchPayer {
+    error Unauthorized();
+    error ReentrantCall();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error TokenTransferFailed(uint256 index);
+
+    uint256 public constant MAX_RECIPIENTS = 200;
+
+    address public immutable owner;
+    uint256 private locked = 1;
+
+    event BatchPaid(address indexed token, uint256 recipients, uint256 total);
+
+    constructor(address owner_) {
+        if (owner_ == address(0)) revert Unauthorized();
+        owner = owner_;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    /// @notice Pays every recipient from this contract's balance.
+    /// @dev Supports ERC-20s that either return true or return no value.
+    function pay(
+        address token,
+        address[] calldata recipients,
+        uint256[] calldata amounts
+    ) external onlyOwner nonReentrant {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_RECIPIENTS) revert BatchTooLarge();
+
+        uint256 total;
+        for (uint256 i; i < length; ++i) {
+            total += amounts[i];
+            _safeTransfer(token, recipients[i], amounts[i], i);
+        }
+        emit BatchPaid(token, length, total);
+    }
+
+    /// @notice Lets the owner recover a token after a failed or retired campaign.
+    function recover(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
+        _safeTransfer(token, recipient, amount, type(uint256).max);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount, uint256 index) private {
+        (bool ok, bytes memory result) = token.call(
+            abi.encodeWithSelector(0xa9059cbb, recipient, amount)
+        );
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
+            revert TokenTransferFailed(index);
+        }
+    }
+}
diff --git a/src/MockERC20.sol b/src/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb8a06b96f4fe162571487dcac3de39faff74b80
--- /dev/null
+++ b/src/MockERC20.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    constructor(address initialHolder, uint256 supply) {
+        balanceOf[initialHolder] = supply;
+    }
+
+    function transfer(address recipient, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[recipient] += amount;
+        return true;
+    }
+}
diff --git a/test/BatchPayer.t.sol b/test/BatchPayer.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..dfcd12b44559d3be857d5b16527f16fee2c5165d
--- /dev/null
+++ b/test/BatchPayer.t.sol
@@ -0,0 +1,66 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {BatchPayer} from "../src/BatchPayer.sol";
+import {MockERC20} from "../src/MockERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+}
+
+contract BatchPayerTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant RECIPIENT_A = address(0xB0B);
+    address private constant RECIPIENT_B = address(0xCA01);
+    address private constant RECIPIENT_C = address(0xD0D);
+
+    BatchPayer private payer;
+    MockERC20 private token;
+
+    function setUp() public {
+        payer = new BatchPayer(OWNER);
+        token = new MockERC20(address(payer), 1_000_000);
+    }
+
+    function testPaysBatch() public {
+        address[] memory recipients = new address[](3);
+        recipients[0] = RECIPIENT_A;
+        recipients[1] = RECIPIENT_B;
+        recipients[2] = RECIPIENT_C;
+        uint256[] memory amounts = new uint256[](3);
+        amounts[0] = 11;
+        amounts[1] = 22;
+        amounts[2] = 33;
+
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+
+        require(token.balanceOf(RECIPIENT_A) == 11, "recipient A not paid");
+        require(token.balanceOf(RECIPIENT_B) == 22, "recipient B not paid");
+        require(token.balanceOf(RECIPIENT_C) == 33, "recipient C not paid");
+    }
+
+    function testRejectsNonOwner() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = RECIPIENT_A;
+        uint256[] memory amounts = new uint256[](1);
+        amounts[0] = 1;
+        (bool ok,) = address(payer).call(
+            abi.encodeCall(BatchPayer.pay, (address(token), recipients, amounts))
+        );
+        require(!ok, "non-owner paid");
+    }
+
+    // This is deliberately separate from the batch test so `forge test
+    // --gas-report` records the cost of the ordinary ERC-20 transfer too.
+    function testDirectTransfersBaseline() public {
+        MockERC20 directToken = new MockERC20(OWNER, 1_000_000);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_A, 11);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_B, 22);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_C, 33);
+    }
+}

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d49ff3bb1559f3ad4dc501e69e40b12b4b298640
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..032dae0ac8eae52f4a229c6453310db8fb2aeb96
--- a/package.json
+++ b/package.json
@@ -1,4 +1,8 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "scripts": {
+    "fees:base": "node scripts/base-fee-policy.mjs",
+    "test": "forge test"
+  }
 }
diff --git a/scripts/base-fee-policy.mjs b/scripts/base-fee-policy.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..aa802605fac580e50d13d3d50ba43238353bacbf
--- /dev/null
+++ b/scripts/base-fee-policy.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+
+// Gets current Base fee data at submission time. It intentionally does not use
+// a copied mainnet priority fee or a static gwei constant.
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const urgency = process.env.FEE_URGENCY ?? "standard";
+const percentile = { economical: 25, standard: 50, urgent: 90 }[urgency];
+if (percentile === undefined) throw new Error("FEE_URGENCY must be economical, standard, or urgent");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const [latest, history, suggestedGasPrice] = await Promise.all([
+  rpc("eth_getBlockByNumber", ["latest", false]),
+  rpc("eth_feeHistory", ["0x5", "latest", [percentile]]),
+  rpc("eth_gasPrice", []),
+]);
+const toBigInt = (hex) => BigInt(hex);
+const baseFee = toBigInt(latest.baseFeePerGas);
+const rewards = history.reward.map((row) => toBigInt(row[0]));
+const priorityFee = rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[Math.floor(rewards.length / 2)];
+// Two blocks of base-fee headroom avoids a replacement storm while retaining a
+// current-chain derived cap. Base may enforce a network minimum gas price, so
+// never set a cap below its current suggestion.
+const maxFeePerGas = [baseFee * 2n + priorityFee, toBigInt(suggestedGasPrice)].reduce((a, b) => a > b ? a : b);
+
+const asGwei = (value) => Number(value) / 1e9;
+console.log(JSON.stringify({
+  chainId: 8453,
+  sampledAt: new Date().toISOString(),
+  urgency,
+  baseFeePerGasWei: baseFee.toString(),
+  maxPriorityFeePerGasWei: priorityFee.toString(),
+  maxFeePerGasWei: maxFeePerGas.toString(),
+  suggestedGasPriceWei: suggestedGasPrice,
+  displayGwei: {
+    baseFee: asGwei(baseFee),
+    maxPriorityFee: asGwei(priorityFee),
+    maxFee: asGwei(maxFeePerGas),
+  },
+}, null, 2));
diff --git a/src/BatchPayer.sol b/src/BatchPayer.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f61adeab92414abbddee11967b9b01dc3e7bc94
--- /dev/null
+++ b/src/BatchPayer.sol
@@ -0,0 +1,72 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Holds payment tokens and distributes them in one transaction.
+/// @dev Fund this contract directly. Do not use `transferFrom` for every
+/// recipient: the allowance update and extra call remove much of the benefit.
+contract BatchPayer {
+    error Unauthorized();
+    error ReentrantCall();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error TokenTransferFailed(uint256 index);
+
+    uint256 public constant MAX_RECIPIENTS = 200;
+
+    address public immutable owner;
+    uint256 private locked = 1;
+
+    event BatchPaid(address indexed token, uint256 recipients, uint256 total);
+
+    constructor(address owner_) {
+        if (owner_ == address(0)) revert Unauthorized();
+        owner = owner_;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    /// @notice Pays every recipient from this contract's balance.
+    /// @dev Supports ERC-20s that either return true or return no value.
+    function pay(
+        address token,
+        address[] calldata recipients,
+        uint256[] calldata amounts
+    ) external onlyOwner nonReentrant {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_RECIPIENTS) revert BatchTooLarge();
+
+        uint256 total;
+        for (uint256 i; i < length; ++i) {
+            total += amounts[i];
+            _safeTransfer(token, recipients[i], amounts[i], i);
+        }
+        emit BatchPaid(token, length, total);
+    }
+
+    /// @notice Lets the owner recover a token after a failed or retired campaign.
+    function recover(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
+        _safeTransfer(token, recipient, amount, type(uint256).max);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount, uint256 index) private {
+        (bool ok, bytes memory result) = token.call(
+            abi.encodeWithSelector(0xa9059cbb, recipient, amount)
+        );
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
+            revert TokenTransferFailed(index);
+        }
+    }
+}
diff --git a/src/MockERC20.sol b/src/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb8a06b96f4fe162571487dcac3de39faff74b80
--- /dev/null
+++ b/src/MockERC20.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    constructor(address initialHolder, uint256 supply) {
+        balanceOf[initialHolder] = supply;
+    }
+
+    function transfer(address recipient, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[recipient] += amount;
+        return true;
+    }
+}
diff --git a/test/BatchPayer.t.sol b/test/BatchPayer.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..dfcd12b44559d3be857d5b16527f16fee2c5165d
--- /dev/null
+++ b/test/BatchPayer.t.sol
@@ -0,0 +1,66 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {BatchPayer} from "../src/BatchPayer.sol";
+import {MockERC20} from "../src/MockERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+}
+
+contract BatchPayerTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant RECIPIENT_A = address(0xB0B);
+    address private constant RECIPIENT_B = address(0xCA01);
+    address private constant RECIPIENT_C = address(0xD0D);
+
+    BatchPayer private payer;
+    MockERC20 private token;
+
+    function setUp() public {
+        payer = new BatchPayer(OWNER);
+        token = new MockERC20(address(payer), 1_000_000);
+    }
+
+    function testPaysBatch() public {
+        address[] memory recipients = new address[](3);
+        recipients[0] = RECIPIENT_A;
+        recipients[1] = RECIPIENT_B;
+        recipients[2] = RECIPIENT_C;
+        uint256[] memory amounts = new uint256[](3);
+        amounts[0] = 11;
+        amounts[1] = 22;
+        amounts[2] = 33;
+
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+
+        require(token.balanceOf(RECIPIENT_A) == 11, "recipient A not paid");
+        require(token.balanceOf(RECIPIENT_B) == 22, "recipient B not paid");
+        require(token.balanceOf(RECIPIENT_C) == 33, "recipient C not paid");
+    }
+
+    function testRejectsNonOwner() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = RECIPIENT_A;
+        uint256[] memory amounts = new uint256[](1);
+        amounts[0] = 1;
+        (bool ok,) = address(payer).call(
+            abi.encodeCall(BatchPayer.pay, (address(token), recipients, amounts))
+        );
+        require(!ok, "non-owner paid");
+    }
+
+    // This is deliberately separate from the batch test so `forge test
+    // --gas-report` records the cost of the ordinary ERC-20 transfer too.
+    function testDirectTransfersBaseline() public {
+        MockERC20 directToken = new MockERC20(OWNER, 1_000_000);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_A, 11);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_B, 22);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_C, 33);
+    }
+}

exec
/bin/bash -lc 'forge test --gas-report' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002
 succeeded in 174ms:
Compiling 1 files with Solc 0.8.24
Solc 0.8.24 finished in 139.19ms
Compiler run successful!

Ran 3 tests for test/BatchPayer.t.sol:BatchPayerTest
[PASS] testDirectTransfersBaseline() (gas: 358699)
[PASS] testPaysBatch() (gas: 135644)
[PASS] testRejectsNonOwner() (gas: 32033)
Suite result: ok. 3 passed; 0 failed; 0 skipped; finished in 694.92µs (778.95µs CPU time)

╭----------------------------------------+-----------------+-------+--------+--------+---------╮
| src/BatchPayer.sol:BatchPayer Contract |                 |       |        |        |         |
+==============================================================================================+
| Deployment Cost                        | Deployment Size |       |        |        |         |
|----------------------------------------+-----------------+-------+--------+--------+---------|
| 403447                                 | 1727            |       |        |        |         |
|----------------------------------------+-----------------+-------+--------+--------+---------|
|                                        |                 |       |        |        |         |
|----------------------------------------+-----------------+-------+--------+--------+---------|
| Function Name                          | Min             | Avg   | Median | Max    | # Calls |
|----------------------------------------+-----------------+-------+--------+--------+---------|
| pay                                    | 23179           | 66030 | 66030  | 108881 | 2       |
╰----------------------------------------+-----------------+-------+--------+--------+---------╯

╭--------------------------------------+-----------------+-------+--------+-------+---------╮
| src/MockERC20.sol:MockERC20 Contract |                 |       |        |       |         |
+===========================================================================================+
| Deployment Cost                      | Deployment Size |       |        |       |         |
|--------------------------------------+-----------------+-------+--------+-------+---------|
| 173983                               | 652             |       |        |       |         |
|--------------------------------------+-----------------+-------+--------+-------+---------|
|                                      |                 |       |        |       |         |
|--------------------------------------+-----------------+-------+--------+-------+---------|
| Function Name                        | Min             | Avg   | Median | Max   | # Calls |
|--------------------------------------+-----------------+-------+--------+-------+---------|
| balanceOf                            | 2486            | 2486  | 2486   | 2486  | 3       |
|--------------------------------------+-----------------+-------+--------+-------+---------|
| transfer                             | 49230           | 49230 | 49230  | 49230 | 3       |
╰--------------------------------------+-----------------+-------+--------+-------+---------╯


Ran 1 test suite in 2.71ms (694.92µs CPU time): 3 tests passed, 0 failed, 0 skipped (3 total tests)

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d49ff3bb1559f3ad4dc501e69e40b12b4b298640
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..032dae0ac8eae52f4a229c6453310db8fb2aeb96
--- a/package.json
+++ b/package.json
@@ -1,4 +1,8 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "scripts": {
+    "fees:base": "node scripts/base-fee-policy.mjs",
+    "test": "forge test"
+  }
 }
diff --git a/scripts/base-fee-policy.mjs b/scripts/base-fee-policy.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..aa802605fac580e50d13d3d50ba43238353bacbf
--- /dev/null
+++ b/scripts/base-fee-policy.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+
+// Gets current Base fee data at submission time. It intentionally does not use
+// a copied mainnet priority fee or a static gwei constant.
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const urgency = process.env.FEE_URGENCY ?? "standard";
+const percentile = { economical: 25, standard: 50, urgent: 90 }[urgency];
+if (percentile === undefined) throw new Error("FEE_URGENCY must be economical, standard, or urgent");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const [latest, history, suggestedGasPrice] = await Promise.all([
+  rpc("eth_getBlockByNumber", ["latest", false]),
+  rpc("eth_feeHistory", ["0x5", "latest", [percentile]]),
+  rpc("eth_gasPrice", []),
+]);
+const toBigInt = (hex) => BigInt(hex);
+const baseFee = toBigInt(latest.baseFeePerGas);
+const rewards = history.reward.map((row) => toBigInt(row[0]));
+const priorityFee = rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[Math.floor(rewards.length / 2)];
+// Two blocks of base-fee headroom avoids a replacement storm while retaining a
+// current-chain derived cap. Base may enforce a network minimum gas price, so
+// never set a cap below its current suggestion.
+const maxFeePerGas = [baseFee * 2n + priorityFee, toBigInt(suggestedGasPrice)].reduce((a, b) => a > b ? a : b);
+
+const asGwei = (value) => Number(value) / 1e9;
+console.log(JSON.stringify({
+  chainId: 8453,
+  sampledAt: new Date().toISOString(),
+  urgency,
+  baseFeePerGasWei: baseFee.toString(),
+  maxPriorityFeePerGasWei: priorityFee.toString(),
+  maxFeePerGasWei: maxFeePerGas.toString(),
+  suggestedGasPriceWei: suggestedGasPrice,
+  displayGwei: {
+    baseFee: asGwei(baseFee),
+    maxPriorityFee: asGwei(priorityFee),
+    maxFee: asGwei(maxFeePerGas),
+  },
+}, null, 2));
diff --git a/src/BatchPayer.sol b/src/BatchPayer.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f61adeab92414abbddee11967b9b01dc3e7bc94
--- /dev/null
+++ b/src/BatchPayer.sol
@@ -0,0 +1,72 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Holds payment tokens and distributes them in one transaction.
+/// @dev Fund this contract directly. Do not use `transferFrom` for every
+/// recipient: the allowance update and extra call remove much of the benefit.
+contract BatchPayer {
+    error Unauthorized();
+    error ReentrantCall();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error TokenTransferFailed(uint256 index);
+
+    uint256 public constant MAX_RECIPIENTS = 200;
+
+    address public immutable owner;
+    uint256 private locked = 1;
+
+    event BatchPaid(address indexed token, uint256 recipients, uint256 total);
+
+    constructor(address owner_) {
+        if (owner_ == address(0)) revert Unauthorized();
+        owner = owner_;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    /// @notice Pays every recipient from this contract's balance.
+    /// @dev Supports ERC-20s that either return true or return no value.
+    function pay(
+        address token,
+        address[] calldata recipients,
+        uint256[] calldata amounts
+    ) external onlyOwner nonReentrant {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_RECIPIENTS) revert BatchTooLarge();
+
+        uint256 total;
+        for (uint256 i; i < length; ++i) {
+            total += amounts[i];
+            _safeTransfer(token, recipients[i], amounts[i], i);
+        }
+        emit BatchPaid(token, length, total);
+    }
+
+    /// @notice Lets the owner recover a token after a failed or retired campaign.
+    function recover(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
+        _safeTransfer(token, recipient, amount, type(uint256).max);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount, uint256 index) private {
+        (bool ok, bytes memory result) = token.call(
+            abi.encodeWithSelector(0xa9059cbb, recipient, amount)
+        );
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
+            revert TokenTransferFailed(index);
+        }
+    }
+}
diff --git a/src/MockERC20.sol b/src/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb8a06b96f4fe162571487dcac3de39faff74b80
--- /dev/null
+++ b/src/MockERC20.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    constructor(address initialHolder, uint256 supply) {
+        balanceOf[initialHolder] = supply;
+    }
+
+    function transfer(address recipient, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[recipient] += amount;
+        return true;
+    }
+}
diff --git a/test/BatchPayer.t.sol b/test/BatchPayer.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..dfcd12b44559d3be857d5b16527f16fee2c5165d
--- /dev/null
+++ b/test/BatchPayer.t.sol
@@ -0,0 +1,66 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {BatchPayer} from "../src/BatchPayer.sol";
+import {MockERC20} from "../src/MockERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+}
+
+contract BatchPayerTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant RECIPIENT_A = address(0xB0B);
+    address private constant RECIPIENT_B = address(0xCA01);
+    address private constant RECIPIENT_C = address(0xD0D);
+
+    BatchPayer private payer;
+    MockERC20 private token;
+
+    function setUp() public {
+        payer = new BatchPayer(OWNER);
+        token = new MockERC20(address(payer), 1_000_000);
+    }
+
+    function testPaysBatch() public {
+        address[] memory recipients = new address[](3);
+        recipients[0] = RECIPIENT_A;
+        recipients[1] = RECIPIENT_B;
+        recipients[2] = RECIPIENT_C;
+        uint256[] memory amounts = new uint256[](3);
+        amounts[0] = 11;
+        amounts[1] = 22;
+        amounts[2] = 33;
+
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+
+        require(token.balanceOf(RECIPIENT_A) == 11, "recipient A not paid");
+        require(token.balanceOf(RECIPIENT_B) == 22, "recipient B not paid");
+        require(token.balanceOf(RECIPIENT_C) == 33, "recipient C not paid");
+    }
+
+    function testRejectsNonOwner() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = RECIPIENT_A;
+        uint256[] memory amounts = new uint256[](1);
+        amounts[0] = 1;
+        (bool ok,) = address(payer).call(
+            abi.encodeCall(BatchPayer.pay, (address(token), recipients, amounts))
+        );
+        require(!ok, "non-owner paid");
+    }
+
+    // This is deliberately separate from the batch test so `forge test
+    // --gas-report` records the cost of the ordinary ERC-20 transfer too.
+    function testDirectTransfersBaseline() public {
+        MockERC20 directToken = new MockERC20(OWNER, 1_000_000);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_A, 11);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_B, 22);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_C, 33);
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002/test/BatchPayer.t.sol
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d49ff3bb1559f3ad4dc501e69e40b12b4b298640
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..032dae0ac8eae52f4a229c6453310db8fb2aeb96
--- a/package.json
+++ b/package.json
@@ -1,4 +1,8 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "scripts": {
+    "fees:base": "node scripts/base-fee-policy.mjs",
+    "test": "forge test"
+  }
 }
diff --git a/scripts/base-fee-policy.mjs b/scripts/base-fee-policy.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..aa802605fac580e50d13d3d50ba43238353bacbf
--- /dev/null
+++ b/scripts/base-fee-policy.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+
+// Gets current Base fee data at submission time. It intentionally does not use
+// a copied mainnet priority fee or a static gwei constant.
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const urgency = process.env.FEE_URGENCY ?? "standard";
+const percentile = { economical: 25, standard: 50, urgent: 90 }[urgency];
+if (percentile === undefined) throw new Error("FEE_URGENCY must be economical, standard, or urgent");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const [latest, history, suggestedGasPrice] = await Promise.all([
+  rpc("eth_getBlockByNumber", ["latest", false]),
+  rpc("eth_feeHistory", ["0x5", "latest", [percentile]]),
+  rpc("eth_gasPrice", []),
+]);
+const toBigInt = (hex) => BigInt(hex);
+const baseFee = toBigInt(latest.baseFeePerGas);
+const rewards = history.reward.map((row) => toBigInt(row[0]));
+const priorityFee = rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[Math.floor(rewards.length / 2)];
+// Two blocks of base-fee headroom avoids a replacement storm while retaining a
+// current-chain derived cap. Base may enforce a network minimum gas price, so
+// never set a cap below its current suggestion.
+const maxFeePerGas = [baseFee * 2n + priorityFee, toBigInt(suggestedGasPrice)].reduce((a, b) => a > b ? a : b);
+
+const asGwei = (value) => Number(value) / 1e9;
+console.log(JSON.stringify({
+  chainId: 8453,
+  sampledAt: new Date().toISOString(),
+  urgency,
+  baseFeePerGasWei: baseFee.toString(),
+  maxPriorityFeePerGasWei: priorityFee.toString(),
+  maxFeePerGasWei: maxFeePerGas.toString(),
+  suggestedGasPriceWei: suggestedGasPrice,
+  displayGwei: {
+    baseFee: asGwei(baseFee),
+    maxPriorityFee: asGwei(priorityFee),
+    maxFee: asGwei(maxFeePerGas),
+  },
+}, null, 2));
diff --git a/src/BatchPayer.sol b/src/BatchPayer.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f61adeab92414abbddee11967b9b01dc3e7bc94
--- /dev/null
+++ b/src/BatchPayer.sol
@@ -0,0 +1,72 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Holds payment tokens and distributes them in one transaction.
+/// @dev Fund this contract directly. Do not use `transferFrom` for every
+/// recipient: the allowance update and extra call remove much of the benefit.
+contract BatchPayer {
+    error Unauthorized();
+    error ReentrantCall();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error TokenTransferFailed(uint256 index);
+
+    uint256 public constant MAX_RECIPIENTS = 200;
+
+    address public immutable owner;
+    uint256 private locked = 1;
+
+    event BatchPaid(address indexed token, uint256 recipients, uint256 total);
+
+    constructor(address owner_) {
+        if (owner_ == address(0)) revert Unauthorized();
+        owner = owner_;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    /// @notice Pays every recipient from this contract's balance.
+    /// @dev Supports ERC-20s that either return true or return no value.
+    function pay(
+        address token,
+        address[] calldata recipients,
+        uint256[] calldata amounts
+    ) external onlyOwner nonReentrant {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_RECIPIENTS) revert BatchTooLarge();
+
+        uint256 total;
+        for (uint256 i; i < length; ++i) {
+            total += amounts[i];
+            _safeTransfer(token, recipients[i], amounts[i], i);
+        }
+        emit BatchPaid(token, length, total);
+    }
+
+    /// @notice Lets the owner recover a token after a failed or retired campaign.
+    function recover(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
+        _safeTransfer(token, recipient, amount, type(uint256).max);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount, uint256 index) private {
+        (bool ok, bytes memory result) = token.call(
+            abi.encodeWithSelector(0xa9059cbb, recipient, amount)
+        );
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
+            revert TokenTransferFailed(index);
+        }
+    }
+}
diff --git a/src/MockERC20.sol b/src/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb8a06b96f4fe162571487dcac3de39faff74b80
--- /dev/null
+++ b/src/MockERC20.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    constructor(address initialHolder, uint256 supply) {
+        balanceOf[initialHolder] = supply;
+    }
+
+    function transfer(address recipient, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[recipient] += amount;
+        return true;
+    }
+}
diff --git a/test/BatchPayer.t.sol b/test/BatchPayer.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a69fbb133ffa2fae928f964b5904de765df64db9
--- /dev/null
+++ b/test/BatchPayer.t.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {BatchPayer} from "../src/BatchPayer.sol";
+import {MockERC20} from "../src/MockERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+}
+
+contract BatchPayerTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant RECIPIENT_A = address(0xB0B);
+    address private constant RECIPIENT_B = address(0xCA01);
+    address private constant RECIPIENT_C = address(0xD0D);
+
+    BatchPayer private payer;
+    MockERC20 private token;
+
+    function setUp() public {
+        payer = new BatchPayer(OWNER);
+        token = new MockERC20(address(payer), 1_000_000);
+    }
+
+    function testPaysBatch() public {
+        address[] memory recipients = new address[](3);
+        recipients[0] = RECIPIENT_A;
+        recipients[1] = RECIPIENT_B;
+        recipients[2] = RECIPIENT_C;
+        uint256[] memory amounts = new uint256[](3);
+        amounts[0] = 11;
+        amounts[1] = 22;
+        amounts[2] = 33;
+
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+
+        require(token.balanceOf(RECIPIENT_A) == 11, "recipient A not paid");
+        require(token.balanceOf(RECIPIENT_B) == 22, "recipient B not paid");
+        require(token.balanceOf(RECIPIENT_C) == 33, "recipient C not paid");
+    }
+
+    function testRejectsNonOwner() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = RECIPIENT_A;
+        uint256[] memory amounts = new uint256[](1);
+        amounts[0] = 1;
+        (bool ok,) = address(payer).call(
+            abi.encodeCall(BatchPayer.pay, (address(token), recipients, amounts))
+        );
+        require(!ok, "non-owner paid");
+    }
+
+    // This is deliberately separate from the batch test so `forge test
+    // --gas-report` records the cost of the ordinary ERC-20 transfer too.
+    function testDirectTransfersBaseline() public {
+        MockERC20 directToken = new MockERC20(OWNER, 1_000_000);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_A, 11);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_B, 22);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_C, 33);
+    }
+
+    function testPaysHundredRecipients() public {
+        address[] memory recipients = new address[](100);
+        uint256[] memory amounts = new uint256[](100);
+        for (uint256 i; i < 100; ++i) {
+            recipients[i] = address(uint160(i + 0x1000));
+            amounts[i] = 1;
+        }
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+        require(token.balanceOf(recipients[99]) == 1, "last recipient not paid");
+    }
+}

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d49ff3bb1559f3ad4dc501e69e40b12b4b298640
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..032dae0ac8eae52f4a229c6453310db8fb2aeb96
--- a/package.json
+++ b/package.json
@@ -1,4 +1,8 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "scripts": {
+    "fees:base": "node scripts/base-fee-policy.mjs",
+    "test": "forge test"
+  }
 }
diff --git a/scripts/base-fee-policy.mjs b/scripts/base-fee-policy.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..aa802605fac580e50d13d3d50ba43238353bacbf
--- /dev/null
+++ b/scripts/base-fee-policy.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+
+// Gets current Base fee data at submission time. It intentionally does not use
+// a copied mainnet priority fee or a static gwei constant.
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const urgency = process.env.FEE_URGENCY ?? "standard";
+const percentile = { economical: 25, standard: 50, urgent: 90 }[urgency];
+if (percentile === undefined) throw new Error("FEE_URGENCY must be economical, standard, or urgent");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const [latest, history, suggestedGasPrice] = await Promise.all([
+  rpc("eth_getBlockByNumber", ["latest", false]),
+  rpc("eth_feeHistory", ["0x5", "latest", [percentile]]),
+  rpc("eth_gasPrice", []),
+]);
+const toBigInt = (hex) => BigInt(hex);
+const baseFee = toBigInt(latest.baseFeePerGas);
+const rewards = history.reward.map((row) => toBigInt(row[0]));
+const priorityFee = rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[Math.floor(rewards.length / 2)];
+// Two blocks of base-fee headroom avoids a replacement storm while retaining a
+// current-chain derived cap. Base may enforce a network minimum gas price, so
+// never set a cap below its current suggestion.
+const maxFeePerGas = [baseFee * 2n + priorityFee, toBigInt(suggestedGasPrice)].reduce((a, b) => a > b ? a : b);
+
+const asGwei = (value) => Number(value) / 1e9;
+console.log(JSON.stringify({
+  chainId: 8453,
+  sampledAt: new Date().toISOString(),
+  urgency,
+  baseFeePerGasWei: baseFee.toString(),
+  maxPriorityFeePerGasWei: priorityFee.toString(),
+  maxFeePerGasWei: maxFeePerGas.toString(),
+  suggestedGasPriceWei: suggestedGasPrice,
+  displayGwei: {
+    baseFee: asGwei(baseFee),
+    maxPriorityFee: asGwei(priorityFee),
+    maxFee: asGwei(maxFeePerGas),
+  },
+}, null, 2));
diff --git a/src/BatchPayer.sol b/src/BatchPayer.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f61adeab92414abbddee11967b9b01dc3e7bc94
--- /dev/null
+++ b/src/BatchPayer.sol
@@ -0,0 +1,72 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Holds payment tokens and distributes them in one transaction.
+/// @dev Fund this contract directly. Do not use `transferFrom` for every
+/// recipient: the allowance update and extra call remove much of the benefit.
+contract BatchPayer {
+    error Unauthorized();
+    error ReentrantCall();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error TokenTransferFailed(uint256 index);
+
+    uint256 public constant MAX_RECIPIENTS = 200;
+
+    address public immutable owner;
+    uint256 private locked = 1;
+
+    event BatchPaid(address indexed token, uint256 recipients, uint256 total);
+
+    constructor(address owner_) {
+        if (owner_ == address(0)) revert Unauthorized();
+        owner = owner_;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    /// @notice Pays every recipient from this contract's balance.
+    /// @dev Supports ERC-20s that either return true or return no value.
+    function pay(
+        address token,
+        address[] calldata recipients,
+        uint256[] calldata amounts
+    ) external onlyOwner nonReentrant {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_RECIPIENTS) revert BatchTooLarge();
+
+        uint256 total;
+        for (uint256 i; i < length; ++i) {
+            total += amounts[i];
+            _safeTransfer(token, recipients[i], amounts[i], i);
+        }
+        emit BatchPaid(token, length, total);
+    }
+
+    /// @notice Lets the owner recover a token after a failed or retired campaign.
+    function recover(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
+        _safeTransfer(token, recipient, amount, type(uint256).max);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount, uint256 index) private {
+        (bool ok, bytes memory result) = token.call(
+            abi.encodeWithSelector(0xa9059cbb, recipient, amount)
+        );
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
+            revert TokenTransferFailed(index);
+        }
+    }
+}
diff --git a/src/MockERC20.sol b/src/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb8a06b96f4fe162571487dcac3de39faff74b80
--- /dev/null
+++ b/src/MockERC20.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    constructor(address initialHolder, uint256 supply) {
+        balanceOf[initialHolder] = supply;
+    }
+
+    function transfer(address recipient, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[recipient] += amount;
+        return true;
+    }
+}
diff --git a/test/BatchPayer.t.sol b/test/BatchPayer.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a69fbb133ffa2fae928f964b5904de765df64db9
--- /dev/null
+++ b/test/BatchPayer.t.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {BatchPayer} from "../src/BatchPayer.sol";
+import {MockERC20} from "../src/MockERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+}
+
+contract BatchPayerTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant RECIPIENT_A = address(0xB0B);
+    address private constant RECIPIENT_B = address(0xCA01);
+    address private constant RECIPIENT_C = address(0xD0D);
+
+    BatchPayer private payer;
+    MockERC20 private token;
+
+    function setUp() public {
+        payer = new BatchPayer(OWNER);
+        token = new MockERC20(address(payer), 1_000_000);
+    }
+
+    function testPaysBatch() public {
+        address[] memory recipients = new address[](3);
+        recipients[0] = RECIPIENT_A;
+        recipients[1] = RECIPIENT_B;
+        recipients[2] = RECIPIENT_C;
+        uint256[] memory amounts = new uint256[](3);
+        amounts[0] = 11;
+        amounts[1] = 22;
+        amounts[2] = 33;
+
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+
+        require(token.balanceOf(RECIPIENT_A) == 11, "recipient A not paid");
+        require(token.balanceOf(RECIPIENT_B) == 22, "recipient B not paid");
+        require(token.balanceOf(RECIPIENT_C) == 33, "recipient C not paid");
+    }
+
+    function testRejectsNonOwner() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = RECIPIENT_A;
+        uint256[] memory amounts = new uint256[](1);
+        amounts[0] = 1;
+        (bool ok,) = address(payer).call(
+            abi.encodeCall(BatchPayer.pay, (address(token), recipients, amounts))
+        );
+        require(!ok, "non-owner paid");
+    }
+
+    // This is deliberately separate from the batch test so `forge test
+    // --gas-report` records the cost of the ordinary ERC-20 transfer too.
+    function testDirectTransfersBaseline() public {
+        MockERC20 directToken = new MockERC20(OWNER, 1_000_000);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_A, 11);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_B, 22);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_C, 33);
+    }
+
+    function testPaysHundredRecipients() public {
+        address[] memory recipients = new address[](100);
+        uint256[] memory amounts = new uint256[](100);
+        for (uint256 i; i < 100; ++i) {
+            recipients[i] = address(uint160(i + 0x1000));
+            amounts[i] = 1;
+        }
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+        require(token.balanceOf(recipients[99]) == 1, "last recipient not paid");
+    }
+}

exec
/bin/bash -lc 'forge test --gas-report && git diff --check' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002
 succeeded in 188ms:
Compiling 1 files with Solc 0.8.24
Solc 0.8.24 finished in 145.75ms
Compiler run successful!

Ran 4 tests for test/BatchPayer.t.sol:BatchPayerTest
[PASS] testDirectTransfersBaseline() (gas: 358699)
[PASS] testPaysBatch() (gas: 135666)
[PASS] testPaysHundredRecipients() (gas: 2577733)
[PASS] testRejectsNonOwner() (gas: 32033)
Suite result: ok. 4 passed; 0 failed; 0 skipped; finished in 2.31ms (2.49ms CPU time)

╭----------------------------------------+-----------------+--------+--------+---------+---------╮
| src/BatchPayer.sol:BatchPayer Contract |                 |        |        |         |         |
+================================================================================================+
| Deployment Cost                        | Deployment Size |        |        |         |         |
|----------------------------------------+-----------------+--------+--------+---------+---------|
| 403447                                 | 1727            |        |        |         |         |
|----------------------------------------+-----------------+--------+--------+---------+---------|
|                                        |                 |        |        |         |         |
|----------------------------------------+-----------------+--------+--------+---------+---------|
| Function Name                          | Min             | Avg    | Median | Max     | # Calls |
|----------------------------------------+-----------------+--------+--------+---------+---------|
| pay                                    | 23179           | 883818 | 108881 | 2519396 | 3       |
╰----------------------------------------+-----------------+--------+--------+---------+---------╯

╭--------------------------------------+-----------------+-------+--------+-------+---------╮
| src/MockERC20.sol:MockERC20 Contract |                 |       |        |       |         |
+===========================================================================================+
| Deployment Cost                      | Deployment Size |       |        |       |         |
|--------------------------------------+-----------------+-------+--------+-------+---------|
| 173983                               | 652             |       |        |       |         |
|--------------------------------------+-----------------+-------+--------+-------+---------|
|                                      |                 |       |        |       |         |
|--------------------------------------+-----------------+-------+--------+-------+---------|
| Function Name                        | Min             | Avg   | Median | Max   | # Calls |
|--------------------------------------+-----------------+-------+--------+-------+---------|
| balanceOf                            | 2486            | 2486  | 2486   | 2486  | 4       |
|--------------------------------------+-----------------+-------+--------+-------+---------|
| transfer                             | 49230           | 49230 | 49230  | 49230 | 3       |
╰--------------------------------------+-----------------+-------+--------+-------+---------╯


Ran 1 test suite in 7.93ms (2.31ms CPU time): 4 tests passed, 0 failed, 0 skipped (4 total tests)

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d49ff3bb1559f3ad4dc501e69e40b12b4b298640
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..032dae0ac8eae52f4a229c6453310db8fb2aeb96
--- a/package.json
+++ b/package.json
@@ -1,4 +1,8 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "scripts": {
+    "fees:base": "node scripts/base-fee-policy.mjs",
+    "test": "forge test"
+  }
 }
diff --git a/scripts/base-fee-policy.mjs b/scripts/base-fee-policy.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..aa802605fac580e50d13d3d50ba43238353bacbf
--- /dev/null
+++ b/scripts/base-fee-policy.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+
+// Gets current Base fee data at submission time. It intentionally does not use
+// a copied mainnet priority fee or a static gwei constant.
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const urgency = process.env.FEE_URGENCY ?? "standard";
+const percentile = { economical: 25, standard: 50, urgent: 90 }[urgency];
+if (percentile === undefined) throw new Error("FEE_URGENCY must be economical, standard, or urgent");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const [latest, history, suggestedGasPrice] = await Promise.all([
+  rpc("eth_getBlockByNumber", ["latest", false]),
+  rpc("eth_feeHistory", ["0x5", "latest", [percentile]]),
+  rpc("eth_gasPrice", []),
+]);
+const toBigInt = (hex) => BigInt(hex);
+const baseFee = toBigInt(latest.baseFeePerGas);
+const rewards = history.reward.map((row) => toBigInt(row[0]));
+const priorityFee = rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[Math.floor(rewards.length / 2)];
+// Two blocks of base-fee headroom avoids a replacement storm while retaining a
+// current-chain derived cap. Base may enforce a network minimum gas price, so
+// never set a cap below its current suggestion.
+const maxFeePerGas = [baseFee * 2n + priorityFee, toBigInt(suggestedGasPrice)].reduce((a, b) => a > b ? a : b);
+
+const asGwei = (value) => Number(value) / 1e9;
+console.log(JSON.stringify({
+  chainId: 8453,
+  sampledAt: new Date().toISOString(),
+  urgency,
+  baseFeePerGasWei: baseFee.toString(),
+  maxPriorityFeePerGasWei: priorityFee.toString(),
+  maxFeePerGasWei: maxFeePerGas.toString(),
+  suggestedGasPriceWei: suggestedGasPrice,
+  displayGwei: {
+    baseFee: asGwei(baseFee),
+    maxPriorityFee: asGwei(priorityFee),
+    maxFee: asGwei(maxFeePerGas),
+  },
+}, null, 2));
diff --git a/src/BatchPayer.sol b/src/BatchPayer.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f61adeab92414abbddee11967b9b01dc3e7bc94
--- /dev/null
+++ b/src/BatchPayer.sol
@@ -0,0 +1,72 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Holds payment tokens and distributes them in one transaction.
+/// @dev Fund this contract directly. Do not use `transferFrom` for every
+/// recipient: the allowance update and extra call remove much of the benefit.
+contract BatchPayer {
+    error Unauthorized();
+    error ReentrantCall();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error TokenTransferFailed(uint256 index);
+
+    uint256 public constant MAX_RECIPIENTS = 200;
+
+    address public immutable owner;
+    uint256 private locked = 1;
+
+    event BatchPaid(address indexed token, uint256 recipients, uint256 total);
+
+    constructor(address owner_) {
+        if (owner_ == address(0)) revert Unauthorized();
+        owner = owner_;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    /// @notice Pays every recipient from this contract's balance.
+    /// @dev Supports ERC-20s that either return true or return no value.
+    function pay(
+        address token,
+        address[] calldata recipients,
+        uint256[] calldata amounts
+    ) external onlyOwner nonReentrant {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_RECIPIENTS) revert BatchTooLarge();
+
+        uint256 total;
+        for (uint256 i; i < length; ++i) {
+            total += amounts[i];
+            _safeTransfer(token, recipients[i], amounts[i], i);
+        }
+        emit BatchPaid(token, length, total);
+    }
+
+    /// @notice Lets the owner recover a token after a failed or retired campaign.
+    function recover(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
+        _safeTransfer(token, recipient, amount, type(uint256).max);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount, uint256 index) private {
+        (bool ok, bytes memory result) = token.call(
+            abi.encodeWithSelector(0xa9059cbb, recipient, amount)
+        );
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
+            revert TokenTransferFailed(index);
+        }
+    }
+}
diff --git a/src/MockERC20.sol b/src/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb8a06b96f4fe162571487dcac3de39faff74b80
--- /dev/null
+++ b/src/MockERC20.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    constructor(address initialHolder, uint256 supply) {
+        balanceOf[initialHolder] = supply;
+    }
+
+    function transfer(address recipient, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[recipient] += amount;
+        return true;
+    }
+}
diff --git a/test/BatchPayer.t.sol b/test/BatchPayer.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a69fbb133ffa2fae928f964b5904de765df64db9
--- /dev/null
+++ b/test/BatchPayer.t.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {BatchPayer} from "../src/BatchPayer.sol";
+import {MockERC20} from "../src/MockERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+}
+
+contract BatchPayerTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant RECIPIENT_A = address(0xB0B);
+    address private constant RECIPIENT_B = address(0xCA01);
+    address private constant RECIPIENT_C = address(0xD0D);
+
+    BatchPayer private payer;
+    MockERC20 private token;
+
+    function setUp() public {
+        payer = new BatchPayer(OWNER);
+        token = new MockERC20(address(payer), 1_000_000);
+    }
+
+    function testPaysBatch() public {
+        address[] memory recipients = new address[](3);
+        recipients[0] = RECIPIENT_A;
+        recipients[1] = RECIPIENT_B;
+        recipients[2] = RECIPIENT_C;
+        uint256[] memory amounts = new uint256[](3);
+        amounts[0] = 11;
+        amounts[1] = 22;
+        amounts[2] = 33;
+
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+
+        require(token.balanceOf(RECIPIENT_A) == 11, "recipient A not paid");
+        require(token.balanceOf(RECIPIENT_B) == 22, "recipient B not paid");
+        require(token.balanceOf(RECIPIENT_C) == 33, "recipient C not paid");
+    }
+
+    function testRejectsNonOwner() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = RECIPIENT_A;
+        uint256[] memory amounts = new uint256[](1);
+        amounts[0] = 1;
+        (bool ok,) = address(payer).call(
+            abi.encodeCall(BatchPayer.pay, (address(token), recipients, amounts))
+        );
+        require(!ok, "non-owner paid");
+    }
+
+    // This is deliberately separate from the batch test so `forge test
+    // --gas-report` records the cost of the ordinary ERC-20 transfer too.
+    function testDirectTransfersBaseline() public {
+        MockERC20 directToken = new MockERC20(OWNER, 1_000_000);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_A, 11);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_B, 22);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_C, 33);
+    }
+
+    function testPaysHundredRecipients() public {
+        address[] memory recipients = new address[](100);
+        uint256[] memory amounts = new uint256[](100);
+        for (uint256 i; i < 100; ++i) {
+            recipients[i] = address(uint160(i + 0x1000));
+            amounts[i] = 1;
+        }
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+        require(token.balanceOf(recipients[99]) == 1, "last recipient not paid");
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002/package.json
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002/scripts/relayer-cost-report.mjs
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d49ff3bb1559f3ad4dc501e69e40b12b4b298640
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..0dd8e7e4d4cd750f53aea4d43e41213a85e7a9cd
--- a/package.json
+++ b/package.json
@@ -1,4 +1,9 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "scripts": {
+    "fees:base": "node scripts/base-fee-policy.mjs",
+    "costs:base": "node scripts/relayer-cost-report.mjs",
+    "test": "forge test"
+  }
 }
diff --git a/scripts/base-fee-policy.mjs b/scripts/base-fee-policy.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..aa802605fac580e50d13d3d50ba43238353bacbf
--- /dev/null
+++ b/scripts/base-fee-policy.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+
+// Gets current Base fee data at submission time. It intentionally does not use
+// a copied mainnet priority fee or a static gwei constant.
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const urgency = process.env.FEE_URGENCY ?? "standard";
+const percentile = { economical: 25, standard: 50, urgent: 90 }[urgency];
+if (percentile === undefined) throw new Error("FEE_URGENCY must be economical, standard, or urgent");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const [latest, history, suggestedGasPrice] = await Promise.all([
+  rpc("eth_getBlockByNumber", ["latest", false]),
+  rpc("eth_feeHistory", ["0x5", "latest", [percentile]]),
+  rpc("eth_gasPrice", []),
+]);
+const toBigInt = (hex) => BigInt(hex);
+const baseFee = toBigInt(latest.baseFeePerGas);
+const rewards = history.reward.map((row) => toBigInt(row[0]));
+const priorityFee = rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[Math.floor(rewards.length / 2)];
+// Two blocks of base-fee headroom avoids a replacement storm while retaining a
+// current-chain derived cap. Base may enforce a network minimum gas price, so
+// never set a cap below its current suggestion.
+const maxFeePerGas = [baseFee * 2n + priorityFee, toBigInt(suggestedGasPrice)].reduce((a, b) => a > b ? a : b);
+
+const asGwei = (value) => Number(value) / 1e9;
+console.log(JSON.stringify({
+  chainId: 8453,
+  sampledAt: new Date().toISOString(),
+  urgency,
+  baseFeePerGasWei: baseFee.toString(),
+  maxPriorityFeePerGasWei: priorityFee.toString(),
+  maxFeePerGasWei: maxFeePerGas.toString(),
+  suggestedGasPriceWei: suggestedGasPrice,
+  displayGwei: {
+    baseFee: asGwei(baseFee),
+    maxPriorityFee: asGwei(priorityFee),
+    maxFee: asGwei(maxFeePerGas),
+  },
+}, null, 2));
diff --git a/scripts/relayer-cost-report.mjs b/scripts/relayer-cost-report.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..09ece32cc1fa74432fe6bccad637bd31bbd6ff86
--- /dev/null
+++ b/scripts/relayer-cost-report.mjs
@@ -0,0 +1,63 @@
+#!/usr/bin/env node
+
+// Usage: node scripts/relayer-cost-report.mjs tx-hashes.txt
+// The input is one Base transaction hash per line. Export these from the
+// relayer database; public Base RPCs cannot efficiently query by sender.
+import { readFile } from "node:fs/promises";
+
+const hashesFile = process.argv[2];
+if (!hashesFile) throw new Error("Usage: node scripts/relayer-cost-report.mjs tx-hashes.txt");
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const hashes = (await readFile(hashesFile, "utf8"))
+  .split(/\s+/)
+  .filter(Boolean)
+  .filter((hash, index, all) => all.indexOf(hash) === index);
+if (hashes.length === 0) throw new Error("No transaction hashes found");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const priceResponse = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot");
+if (!priceResponse.ok) throw new Error("Could not fetch ETH/USD spot price");
+const ethUsd = Number((await priceResponse.json()).data.amount);
+const receipts = [];
+// Keep requests bounded so this can run against conservative public RPC limits.
+for (let i = 0; i < hashes.length; i += 20) {
+  const group = hashes.slice(i, i + 20);
+  receipts.push(...await Promise.all(group.map((hash) => rpc("eth_getTransactionReceipt", [hash]))));
+}
+
+let executionWei = 0n;
+let l1Wei = 0n;
+for (let i = 0; i < receipts.length; ++i) {
+  const receipt = receipts[i];
+  if (!receipt) throw new Error(`Receipt not found: ${hashes[i]}`);
+  executionWei += BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice);
+  // OP-stack receipts expose l1Fee. Treat its absence as zero, but surface it
+  // so a provider schema change cannot silently be mistaken for a saving.
+  l1Wei += receipt.l1Fee ? BigInt(receipt.l1Fee) : 0n;
+}
+const totalWei = executionWei + l1Wei;
+const weiToEth = (value) => Number(value) / 1e18;
+const usd = (value) => weiToEth(value) * ethUsd;
+console.log(JSON.stringify({
+  chainId: 8453,
+  transactions: receipts.length,
+  ethUsd,
+  executionWei: executionWei.toString(),
+  l1DataWei: l1Wei.toString(),
+  totalWei: totalWei.toString(),
+  executionUsd: usd(executionWei),
+  l1DataUsd: usd(l1Wei),
+  totalUsd: usd(totalWei),
+  averageUsdPerTransaction: usd(totalWei) / receipts.length,
+  receiptsWithoutL1Fee: receipts.filter((receipt) => !receipt.l1Fee).length,
+}, null, 2));
diff --git a/src/BatchPayer.sol b/src/BatchPayer.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f61adeab92414abbddee11967b9b01dc3e7bc94
--- /dev/null
+++ b/src/BatchPayer.sol
@@ -0,0 +1,72 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Holds payment tokens and distributes them in one transaction.
+/// @dev Fund this contract directly. Do not use `transferFrom` for every
+/// recipient: the allowance update and extra call remove much of the benefit.
+contract BatchPayer {
+    error Unauthorized();
+    error ReentrantCall();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error TokenTransferFailed(uint256 index);
+
+    uint256 public constant MAX_RECIPIENTS = 200;
+
+    address public immutable owner;
+    uint256 private locked = 1;
+
+    event BatchPaid(address indexed token, uint256 recipients, uint256 total);
+
+    constructor(address owner_) {
+        if (owner_ == address(0)) revert Unauthorized();
+        owner = owner_;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    /// @notice Pays every recipient from this contract's balance.
+    /// @dev Supports ERC-20s that either return true or return no value.
+    function pay(
+        address token,
+        address[] calldata recipients,
+        uint256[] calldata amounts
+    ) external onlyOwner nonReentrant {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_RECIPIENTS) revert BatchTooLarge();
+
+        uint256 total;
+        for (uint256 i; i < length; ++i) {
+            total += amounts[i];
+            _safeTransfer(token, recipients[i], amounts[i], i);
+        }
+        emit BatchPaid(token, length, total);
+    }
+
+    /// @notice Lets the owner recover a token after a failed or retired campaign.
+    function recover(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
+        _safeTransfer(token, recipient, amount, type(uint256).max);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount, uint256 index) private {
+        (bool ok, bytes memory result) = token.call(
+            abi.encodeWithSelector(0xa9059cbb, recipient, amount)
+        );
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
+            revert TokenTransferFailed(index);
+        }
+    }
+}
diff --git a/src/MockERC20.sol b/src/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb8a06b96f4fe162571487dcac3de39faff74b80
--- /dev/null
+++ b/src/MockERC20.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    constructor(address initialHolder, uint256 supply) {
+        balanceOf[initialHolder] = supply;
+    }
+
+    function transfer(address recipient, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[recipient] += amount;
+        return true;
+    }
+}
diff --git a/test/BatchPayer.t.sol b/test/BatchPayer.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a69fbb133ffa2fae928f964b5904de765df64db9
--- /dev/null
+++ b/test/BatchPayer.t.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {BatchPayer} from "../src/BatchPayer.sol";
+import {MockERC20} from "../src/MockERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+}
+
+contract BatchPayerTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant RECIPIENT_A = address(0xB0B);
+    address private constant RECIPIENT_B = address(0xCA01);
+    address private constant RECIPIENT_C = address(0xD0D);
+
+    BatchPayer private payer;
+    MockERC20 private token;
+
+    function setUp() public {
+        payer = new BatchPayer(OWNER);
+        token = new MockERC20(address(payer), 1_000_000);
+    }
+
+    function testPaysBatch() public {
+        address[] memory recipients = new address[](3);
+        recipients[0] = RECIPIENT_A;
+        recipients[1] = RECIPIENT_B;
+        recipients[2] = RECIPIENT_C;
+        uint256[] memory amounts = new uint256[](3);
+        amounts[0] = 11;
+        amounts[1] = 22;
+        amounts[2] = 33;
+
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+
+        require(token.balanceOf(RECIPIENT_A) == 11, "recipient A not paid");
+        require(token.balanceOf(RECIPIENT_B) == 22, "recipient B not paid");
+        require(token.balanceOf(RECIPIENT_C) == 33, "recipient C not paid");
+    }
+
+    function testRejectsNonOwner() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = RECIPIENT_A;
+        uint256[] memory amounts = new uint256[](1);
+        amounts[0] = 1;
+        (bool ok,) = address(payer).call(
+            abi.encodeCall(BatchPayer.pay, (address(token), recipients, amounts))
+        );
+        require(!ok, "non-owner paid");
+    }
+
+    // This is deliberately separate from the batch test so `forge test
+    // --gas-report` records the cost of the ordinary ERC-20 transfer too.
+    function testDirectTransfersBaseline() public {
+        MockERC20 directToken = new MockERC20(OWNER, 1_000_000);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_A, 11);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_B, 22);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_C, 33);
+    }
+
+    function testPaysHundredRecipients() public {
+        address[] memory recipients = new address[](100);
+        uint256[] memory amounts = new uint256[](100);
+        for (uint256 i; i < 100; ++i) {
+            recipients[i] = address(uint160(i + 0x1000));
+            amounts[i] = 1;
+        }
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+        require(token.balanceOf(recipients[99]) == 1, "last recipient not paid");
+    }
+}

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d49ff3bb1559f3ad4dc501e69e40b12b4b298640
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..0dd8e7e4d4cd750f53aea4d43e41213a85e7a9cd
--- a/package.json
+++ b/package.json
@@ -1,4 +1,9 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "scripts": {
+    "fees:base": "node scripts/base-fee-policy.mjs",
+    "costs:base": "node scripts/relayer-cost-report.mjs",
+    "test": "forge test"
+  }
 }
diff --git a/scripts/base-fee-policy.mjs b/scripts/base-fee-policy.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..aa802605fac580e50d13d3d50ba43238353bacbf
--- /dev/null
+++ b/scripts/base-fee-policy.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+
+// Gets current Base fee data at submission time. It intentionally does not use
+// a copied mainnet priority fee or a static gwei constant.
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const urgency = process.env.FEE_URGENCY ?? "standard";
+const percentile = { economical: 25, standard: 50, urgent: 90 }[urgency];
+if (percentile === undefined) throw new Error("FEE_URGENCY must be economical, standard, or urgent");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const [latest, history, suggestedGasPrice] = await Promise.all([
+  rpc("eth_getBlockByNumber", ["latest", false]),
+  rpc("eth_feeHistory", ["0x5", "latest", [percentile]]),
+  rpc("eth_gasPrice", []),
+]);
+const toBigInt = (hex) => BigInt(hex);
+const baseFee = toBigInt(latest.baseFeePerGas);
+const rewards = history.reward.map((row) => toBigInt(row[0]));
+const priorityFee = rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[Math.floor(rewards.length / 2)];
+// Two blocks of base-fee headroom avoids a replacement storm while retaining a
+// current-chain derived cap. Base may enforce a network minimum gas price, so
+// never set a cap below its current suggestion.
+const maxFeePerGas = [baseFee * 2n + priorityFee, toBigInt(suggestedGasPrice)].reduce((a, b) => a > b ? a : b);
+
+const asGwei = (value) => Number(value) / 1e9;
+console.log(JSON.stringify({
+  chainId: 8453,
+  sampledAt: new Date().toISOString(),
+  urgency,
+  baseFeePerGasWei: baseFee.toString(),
+  maxPriorityFeePerGasWei: priorityFee.toString(),
+  maxFeePerGasWei: maxFeePerGas.toString(),
+  suggestedGasPriceWei: suggestedGasPrice,
+  displayGwei: {
+    baseFee: asGwei(baseFee),
+    maxPriorityFee: asGwei(priorityFee),
+    maxFee: asGwei(maxFeePerGas),
+  },
+}, null, 2));
diff --git a/scripts/relayer-cost-report.mjs b/scripts/relayer-cost-report.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..09ece32cc1fa74432fe6bccad637bd31bbd6ff86
--- /dev/null
+++ b/scripts/relayer-cost-report.mjs
@@ -0,0 +1,63 @@
+#!/usr/bin/env node
+
+// Usage: node scripts/relayer-cost-report.mjs tx-hashes.txt
+// The input is one Base transaction hash per line. Export these from the
+// relayer database; public Base RPCs cannot efficiently query by sender.
+import { readFile } from "node:fs/promises";
+
+const hashesFile = process.argv[2];
+if (!hashesFile) throw new Error("Usage: node scripts/relayer-cost-report.mjs tx-hashes.txt");
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const hashes = (await readFile(hashesFile, "utf8"))
+  .split(/\s+/)
+  .filter(Boolean)
+  .filter((hash, index, all) => all.indexOf(hash) === index);
+if (hashes.length === 0) throw new Error("No transaction hashes found");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const priceResponse = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot");
+if (!priceResponse.ok) throw new Error("Could not fetch ETH/USD spot price");
+const ethUsd = Number((await priceResponse.json()).data.amount);
+const receipts = [];
+// Keep requests bounded so this can run against conservative public RPC limits.
+for (let i = 0; i < hashes.length; i += 20) {
+  const group = hashes.slice(i, i + 20);
+  receipts.push(...await Promise.all(group.map((hash) => rpc("eth_getTransactionReceipt", [hash]))));
+}
+
+let executionWei = 0n;
+let l1Wei = 0n;
+for (let i = 0; i < receipts.length; ++i) {
+  const receipt = receipts[i];
+  if (!receipt) throw new Error(`Receipt not found: ${hashes[i]}`);
+  executionWei += BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice);
+  // OP-stack receipts expose l1Fee. Treat its absence as zero, but surface it
+  // so a provider schema change cannot silently be mistaken for a saving.
+  l1Wei += receipt.l1Fee ? BigInt(receipt.l1Fee) : 0n;
+}
+const totalWei = executionWei + l1Wei;
+const weiToEth = (value) => Number(value) / 1e18;
+const usd = (value) => weiToEth(value) * ethUsd;
+console.log(JSON.stringify({
+  chainId: 8453,
+  transactions: receipts.length,
+  ethUsd,
+  executionWei: executionWei.toString(),
+  l1DataWei: l1Wei.toString(),
+  totalWei: totalWei.toString(),
+  executionUsd: usd(executionWei),
+  l1DataUsd: usd(l1Wei),
+  totalUsd: usd(totalWei),
+  averageUsdPerTransaction: usd(totalWei) / receipts.length,
+  receiptsWithoutL1Fee: receipts.filter((receipt) => !receipt.l1Fee).length,
+}, null, 2));
diff --git a/src/BatchPayer.sol b/src/BatchPayer.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f61adeab92414abbddee11967b9b01dc3e7bc94
--- /dev/null
+++ b/src/BatchPayer.sol
@@ -0,0 +1,72 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Holds payment tokens and distributes them in one transaction.
+/// @dev Fund this contract directly. Do not use `transferFrom` for every
+/// recipient: the allowance update and extra call remove much of the benefit.
+contract BatchPayer {
+    error Unauthorized();
+    error ReentrantCall();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error TokenTransferFailed(uint256 index);
+
+    uint256 public constant MAX_RECIPIENTS = 200;
+
+    address public immutable owner;
+    uint256 private locked = 1;
+
+    event BatchPaid(address indexed token, uint256 recipients, uint256 total);
+
+    constructor(address owner_) {
+        if (owner_ == address(0)) revert Unauthorized();
+        owner = owner_;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    /// @notice Pays every recipient from this contract's balance.
+    /// @dev Supports ERC-20s that either return true or return no value.
+    function pay(
+        address token,
+        address[] calldata recipients,
+        uint256[] calldata amounts
+    ) external onlyOwner nonReentrant {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_RECIPIENTS) revert BatchTooLarge();
+
+        uint256 total;
+        for (uint256 i; i < length; ++i) {
+            total += amounts[i];
+            _safeTransfer(token, recipients[i], amounts[i], i);
+        }
+        emit BatchPaid(token, length, total);
+    }
+
+    /// @notice Lets the owner recover a token after a failed or retired campaign.
+    function recover(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
+        _safeTransfer(token, recipient, amount, type(uint256).max);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount, uint256 index) private {
+        (bool ok, bytes memory result) = token.call(
+            abi.encodeWithSelector(0xa9059cbb, recipient, amount)
+        );
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
+            revert TokenTransferFailed(index);
+        }
+    }
+}
diff --git a/src/MockERC20.sol b/src/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb8a06b96f4fe162571487dcac3de39faff74b80
--- /dev/null
+++ b/src/MockERC20.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    constructor(address initialHolder, uint256 supply) {
+        balanceOf[initialHolder] = supply;
+    }
+
+    function transfer(address recipient, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[recipient] += amount;
+        return true;
+    }
+}
diff --git a/test/BatchPayer.t.sol b/test/BatchPayer.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a69fbb133ffa2fae928f964b5904de765df64db9
--- /dev/null
+++ b/test/BatchPayer.t.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {BatchPayer} from "../src/BatchPayer.sol";
+import {MockERC20} from "../src/MockERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+}
+
+contract BatchPayerTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant RECIPIENT_A = address(0xB0B);
+    address private constant RECIPIENT_B = address(0xCA01);
+    address private constant RECIPIENT_C = address(0xD0D);
+
+    BatchPayer private payer;
+    MockERC20 private token;
+
+    function setUp() public {
+        payer = new BatchPayer(OWNER);
+        token = new MockERC20(address(payer), 1_000_000);
+    }
+
+    function testPaysBatch() public {
+        address[] memory recipients = new address[](3);
+        recipients[0] = RECIPIENT_A;
+        recipients[1] = RECIPIENT_B;
+        recipients[2] = RECIPIENT_C;
+        uint256[] memory amounts = new uint256[](3);
+        amounts[0] = 11;
+        amounts[1] = 22;
+        amounts[2] = 33;
+
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+
+        require(token.balanceOf(RECIPIENT_A) == 11, "recipient A not paid");
+        require(token.balanceOf(RECIPIENT_B) == 22, "recipient B not paid");
+        require(token.balanceOf(RECIPIENT_C) == 33, "recipient C not paid");
+    }
+
+    function testRejectsNonOwner() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = RECIPIENT_A;
+        uint256[] memory amounts = new uint256[](1);
+        amounts[0] = 1;
+        (bool ok,) = address(payer).call(
+            abi.encodeCall(BatchPayer.pay, (address(token), recipients, amounts))
+        );
+        require(!ok, "non-owner paid");
+    }
+
+    // This is deliberately separate from the batch test so `forge test
+    // --gas-report` records the cost of the ordinary ERC-20 transfer too.
+    function testDirectTransfersBaseline() public {
+        MockERC20 directToken = new MockERC20(OWNER, 1_000_000);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_A, 11);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_B, 22);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_C, 33);
+    }
+
+    function testPaysHundredRecipients() public {
+        address[] memory recipients = new address[](100);
+        uint256[] memory amounts = new uint256[](100);
+        for (uint256 i; i < 100; ++i) {
+            recipients[i] = address(uint160(i + 0x1000));
+            amounts[i] = 1;
+        }
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+        require(token.balanceOf(recipients[99]) == 1, "last recipient not paid");
+    }
+}

exec
/bin/bash -lc "node scripts/relayer-cost-report.mjs <(printf '%s\\n' 0x0e4ffb9e73f39bb860ead1616795a8dc480ec8e856209034ceb97b462f863c4b) && npm run fees:base && forge test && git diff --check" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002
 succeeded in 2174ms:
{
  "chainId": 8453,
  "transactions": 1,
  "ethUsd": 2509.38,
  "executionWei": "270282000000",
  "l1DataWei": "462707932",
  "totalWei": "270744707932",
  "executionUsd": 0.00067824024516,
  "l1DataUsd": 0.0000011611100304021602,
  "totalUsd": 0.0006794013551904022,
  "averageUsdPerTransaction": 0.0006794013551904022,
  "receiptsWithoutL1Fee": 0
}

> fees:base
> node scripts/base-fee-policy.mjs

{
  "chainId": 8453,
  "sampledAt": "2026-08-28T00:02:42.037Z",
  "urgency": "standard",
  "baseFeePerGasWei": "5000000",
  "maxPriorityFeePerGasWei": "1000000",
  "maxFeePerGasWei": "11000000",
  "suggestedGasPriceWei": "0x5b8d80",
  "displayGwei": {
    "baseFee": 0.005,
    "maxPriorityFee": 0.001,
    "maxFee": 0.011
  }
}
No files changed, compilation skipped

Ran 4 tests for test/BatchPayer.t.sol:BatchPayerTest
[PASS] testDirectTransfersBaseline() (gas: 217789)
[PASS] testPaysBatch() (gas: 100598)
[PASS] testPaysHundredRecipients() (gas: 2527353)
[PASS] testRejectsNonOwner() (gas: 9749)
Suite result: ok. 4 passed; 0 failed; 0 skipped; finished in 1.59ms (1.72ms CPU time)

Ran 1 test suite in 7.59ms (1.59ms CPU time): 4 tests passed, 0 failed, 0 skipped (4 total tests)

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d49ff3bb1559f3ad4dc501e69e40b12b4b298640
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..0dd8e7e4d4cd750f53aea4d43e41213a85e7a9cd
--- a/package.json
+++ b/package.json
@@ -1,4 +1,9 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "scripts": {
+    "fees:base": "node scripts/base-fee-policy.mjs",
+    "costs:base": "node scripts/relayer-cost-report.mjs",
+    "test": "forge test"
+  }
 }
diff --git a/scripts/base-fee-policy.mjs b/scripts/base-fee-policy.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..aa802605fac580e50d13d3d50ba43238353bacbf
--- /dev/null
+++ b/scripts/base-fee-policy.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+
+// Gets current Base fee data at submission time. It intentionally does not use
+// a copied mainnet priority fee or a static gwei constant.
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const urgency = process.env.FEE_URGENCY ?? "standard";
+const percentile = { economical: 25, standard: 50, urgent: 90 }[urgency];
+if (percentile === undefined) throw new Error("FEE_URGENCY must be economical, standard, or urgent");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const [latest, history, suggestedGasPrice] = await Promise.all([
+  rpc("eth_getBlockByNumber", ["latest", false]),
+  rpc("eth_feeHistory", ["0x5", "latest", [percentile]]),
+  rpc("eth_gasPrice", []),
+]);
+const toBigInt = (hex) => BigInt(hex);
+const baseFee = toBigInt(latest.baseFeePerGas);
+const rewards = history.reward.map((row) => toBigInt(row[0]));
+const priorityFee = rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[Math.floor(rewards.length / 2)];
+// Two blocks of base-fee headroom avoids a replacement storm while retaining a
+// current-chain derived cap. Base may enforce a network minimum gas price, so
+// never set a cap below its current suggestion.
+const maxFeePerGas = [baseFee * 2n + priorityFee, toBigInt(suggestedGasPrice)].reduce((a, b) => a > b ? a : b);
+
+const asGwei = (value) => Number(value) / 1e9;
+console.log(JSON.stringify({
+  chainId: 8453,
+  sampledAt: new Date().toISOString(),
+  urgency,
+  baseFeePerGasWei: baseFee.toString(),
+  maxPriorityFeePerGasWei: priorityFee.toString(),
+  maxFeePerGasWei: maxFeePerGas.toString(),
+  suggestedGasPriceWei: suggestedGasPrice,
+  displayGwei: {
+    baseFee: asGwei(baseFee),
+    maxPriorityFee: asGwei(priorityFee),
+    maxFee: asGwei(maxFeePerGas),
+  },
+}, null, 2));
diff --git a/scripts/relayer-cost-report.mjs b/scripts/relayer-cost-report.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..09ece32cc1fa74432fe6bccad637bd31bbd6ff86
--- /dev/null
+++ b/scripts/relayer-cost-report.mjs
@@ -0,0 +1,63 @@
+#!/usr/bin/env node
+
+// Usage: node scripts/relayer-cost-report.mjs tx-hashes.txt
+// The input is one Base transaction hash per line. Export these from the
+// relayer database; public Base RPCs cannot efficiently query by sender.
+import { readFile } from "node:fs/promises";
+
+const hashesFile = process.argv[2];
+if (!hashesFile) throw new Error("Usage: node scripts/relayer-cost-report.mjs tx-hashes.txt");
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const hashes = (await readFile(hashesFile, "utf8"))
+  .split(/\s+/)
+  .filter(Boolean)
+  .filter((hash, index, all) => all.indexOf(hash) === index);
+if (hashes.length === 0) throw new Error("No transaction hashes found");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const priceResponse = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot");
+if (!priceResponse.ok) throw new Error("Could not fetch ETH/USD spot price");
+const ethUsd = Number((await priceResponse.json()).data.amount);
+const receipts = [];
+// Keep requests bounded so this can run against conservative public RPC limits.
+for (let i = 0; i < hashes.length; i += 20) {
+  const group = hashes.slice(i, i + 20);
+  receipts.push(...await Promise.all(group.map((hash) => rpc("eth_getTransactionReceipt", [hash]))));
+}
+
+let executionWei = 0n;
+let l1Wei = 0n;
+for (let i = 0; i < receipts.length; ++i) {
+  const receipt = receipts[i];
+  if (!receipt) throw new Error(`Receipt not found: ${hashes[i]}`);
+  executionWei += BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice);
+  // OP-stack receipts expose l1Fee. Treat its absence as zero, but surface it
+  // so a provider schema change cannot silently be mistaken for a saving.
+  l1Wei += receipt.l1Fee ? BigInt(receipt.l1Fee) : 0n;
+}
+const totalWei = executionWei + l1Wei;
+const weiToEth = (value) => Number(value) / 1e18;
+const usd = (value) => weiToEth(value) * ethUsd;
+console.log(JSON.stringify({
+  chainId: 8453,
+  transactions: receipts.length,
+  ethUsd,
+  executionWei: executionWei.toString(),
+  l1DataWei: l1Wei.toString(),
+  totalWei: totalWei.toString(),
+  executionUsd: usd(executionWei),
+  l1DataUsd: usd(l1Wei),
+  totalUsd: usd(totalWei),
+  averageUsdPerTransaction: usd(totalWei) / receipts.length,
+  receiptsWithoutL1Fee: receipts.filter((receipt) => !receipt.l1Fee).length,
+}, null, 2));
diff --git a/src/BatchPayer.sol b/src/BatchPayer.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f61adeab92414abbddee11967b9b01dc3e7bc94
--- /dev/null
+++ b/src/BatchPayer.sol
@@ -0,0 +1,72 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Holds payment tokens and distributes them in one transaction.
+/// @dev Fund this contract directly. Do not use `transferFrom` for every
+/// recipient: the allowance update and extra call remove much of the benefit.
+contract BatchPayer {
+    error Unauthorized();
+    error ReentrantCall();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error TokenTransferFailed(uint256 index);
+
+    uint256 public constant MAX_RECIPIENTS = 200;
+
+    address public immutable owner;
+    uint256 private locked = 1;
+
+    event BatchPaid(address indexed token, uint256 recipients, uint256 total);
+
+    constructor(address owner_) {
+        if (owner_ == address(0)) revert Unauthorized();
+        owner = owner_;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    /// @notice Pays every recipient from this contract's balance.
+    /// @dev Supports ERC-20s that either return true or return no value.
+    function pay(
+        address token,
+        address[] calldata recipients,
+        uint256[] calldata amounts
+    ) external onlyOwner nonReentrant {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_RECIPIENTS) revert BatchTooLarge();
+
+        uint256 total;
+        for (uint256 i; i < length; ++i) {
+            total += amounts[i];
+            _safeTransfer(token, recipients[i], amounts[i], i);
+        }
+        emit BatchPaid(token, length, total);
+    }
+
+    /// @notice Lets the owner recover a token after a failed or retired campaign.
+    function recover(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
+        _safeTransfer(token, recipient, amount, type(uint256).max);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount, uint256 index) private {
+        (bool ok, bytes memory result) = token.call(
+            abi.encodeWithSelector(0xa9059cbb, recipient, amount)
+        );
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
+            revert TokenTransferFailed(index);
+        }
+    }
+}
diff --git a/src/MockERC20.sol b/src/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb8a06b96f4fe162571487dcac3de39faff74b80
--- /dev/null
+++ b/src/MockERC20.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    constructor(address initialHolder, uint256 supply) {
+        balanceOf[initialHolder] = supply;
+    }
+
+    function transfer(address recipient, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[recipient] += amount;
+        return true;
+    }
+}
diff --git a/test/BatchPayer.t.sol b/test/BatchPayer.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a69fbb133ffa2fae928f964b5904de765df64db9
--- /dev/null
+++ b/test/BatchPayer.t.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {BatchPayer} from "../src/BatchPayer.sol";
+import {MockERC20} from "../src/MockERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+}
+
+contract BatchPayerTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant RECIPIENT_A = address(0xB0B);
+    address private constant RECIPIENT_B = address(0xCA01);
+    address private constant RECIPIENT_C = address(0xD0D);
+
+    BatchPayer private payer;
+    MockERC20 private token;
+
+    function setUp() public {
+        payer = new BatchPayer(OWNER);
+        token = new MockERC20(address(payer), 1_000_000);
+    }
+
+    function testPaysBatch() public {
+        address[] memory recipients = new address[](3);
+        recipients[0] = RECIPIENT_A;
+        recipients[1] = RECIPIENT_B;
+        recipients[2] = RECIPIENT_C;
+        uint256[] memory amounts = new uint256[](3);
+        amounts[0] = 11;
+        amounts[1] = 22;
+        amounts[2] = 33;
+
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+
+        require(token.balanceOf(RECIPIENT_A) == 11, "recipient A not paid");
+        require(token.balanceOf(RECIPIENT_B) == 22, "recipient B not paid");
+        require(token.balanceOf(RECIPIENT_C) == 33, "recipient C not paid");
+    }
+
+    function testRejectsNonOwner() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = RECIPIENT_A;
+        uint256[] memory amounts = new uint256[](1);
+        amounts[0] = 1;
+        (bool ok,) = address(payer).call(
+            abi.encodeCall(BatchPayer.pay, (address(token), recipients, amounts))
+        );
+        require(!ok, "non-owner paid");
+    }
+
+    // This is deliberately separate from the batch test so `forge test
+    // --gas-report` records the cost of the ordinary ERC-20 transfer too.
+    function testDirectTransfersBaseline() public {
+        MockERC20 directToken = new MockERC20(OWNER, 1_000_000);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_A, 11);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_B, 22);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_C, 33);
+    }
+
+    function testPaysHundredRecipients() public {
+        address[] memory recipients = new address[](100);
+        uint256[] memory amounts = new uint256[](100);
+        for (uint256 i; i < 100; ++i) {
+            recipients[i] = address(uint160(i + 0x1000));
+            amounts[i] = 1;
+        }
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+        require(token.balanceOf(recipients[99]) == 1, "last recipient not paid");
+    }
+}

codex
I’ve added a receipt-based cost reporter, a live Base fee-policy helper, and a batch-disbursement contract with tests. The batch benchmark (100 recipients) uses about 2.52M gas versus 4.92M for 100 standalone mock transfers—roughly a 49% execution-gas reduction; the plan will keep the dollar claim conservative and separate L1 data fees.
apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002/PLAN.md
diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..1dd568ea611b9f50f6c959e0a9f899eb992fe89d
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,126 @@
+# Base relayer gas plan
+
+## Current run rate
+
+This is a live, reproducible point-in-time estimate, not a stale gas-price
+assumption. On 2026-08-28 00:02 UTC, a confirmed plain Base USDC transfer
+(`0x0e4ffb9e73f39bb860ead1616795a8dc480ec8e856209034ceb97b462f863c4b`)
+had these receipt fields:
+
+| Component | Measured amount | Cost at ETH = $2,509.38 |
+| --- | ---: | ---: |
+| L2 execution | 45,047 gas × 0.006 gwei = 270,282,000,000 wei | $0.00067824 |
+| L1 data fee | 462,707,932 wei | $0.00000116 |
+| **One payment** | **270,744,707,932 wei** | **$0.00067940** |
+| **40,000 payments/day** | — | **$27.18/day** |
+| **30-day month** | — | **$815.28/month** |
+| **365-day year** | — | **$9,919.26/year** |
+
+Formula: `gasUsed × effectiveGasPrice + l1Fee`; USD is the result in ETH
+multiplied by live ETH/USD. The L1 fee is only 0.17% of this sample, so Base
+execution gas—not data availability—is the meaningful lever today. Values move
+with the receipt and ETH/USD price.
+
+Run `npm run costs:base -- tx-hashes.txt` against a daily export of relayer
+transaction hashes. It calculates the actual total and explicitly includes the
+OP-stack `l1Fee`; use that report for Finance's ledger rather than extrapolating
+this one transaction forever.
+
+## Ranked actions
+
+### 1. Ship batched payouts in groups of 100 — estimated $397/month saved
+
+This is the largest known saving. Instead of 100 externally submitted ERC-20
+transactions, submit one transaction that calls the token 100 times from a
+funded payout contract.
+
+The included local benchmark, using new recipient balances (the expensive common
+case), measured 2,519,396 gas for `BatchPayer.pay` with 100 recipients. The
+same mock token's standalone `transfer` is 49,230 gas, or 4,923,000 gas for
+100 payments. That is a 48.82% execution-gas reduction:
+
+```
+daily execution spend     = 40,000 × 45,047 × 0.006 gwei × $2,509.38 = $27.13
+estimated daily saving    = $27.13 × 48.82% = $13.24
+estimated 30-day saving   = $397.25
+estimated annual saving   = $4,833
+```
+
+The estimate deliberately does **not** take a saving on L1 data fees. Before
+rollout, deploy on Base testnet, run the actual token and representative
+recipient mix through `eth_estimateGas`, and replace the 48.82% benchmark with
+the measured total including `l1Fee`. Use an initial 100-recipient batch; the
+contract permits at most 200 only as a safety ceiling, not a default.
+
+Operational trade-off: this requires prefunding the contract, rather than
+holding tokens in the relayer EOA. That changes custody and must get a security
+review, monitoring, and a staged rollout. It also assumes a conventional ERC-20
+that returns `true` or no return value; fee-on-transfer/rebasing tokens require
+token-specific payment reconciliation. The deploy itself is negligible at the
+observed price: 403,447 gas × 0.006 gwei × $2,509.38 = about $0.006.
+
+Implemented: `src/BatchPayer.sol`, with owner-only payments, token-transfer
+checks, a reentrancy guard, recovery, and a 200-recipient ceiling. Tests cover
+normal payments, access control, and the 100-recipient case.
+
+### 2. Derive EIP-1559 fees from Base immediately before submission — $0 now; $135/month per excess 0.001 gwei eliminated
+
+The live Base RPC at the measurement time reported a 0.005 gwei base fee and
+0.006 gwei suggested gas price. If the relayer already lands at that effective
+price, this change saves no money today; it prevents an accidental overbid.
+
+At this workload, every **0.001 gwei** of avoidable *effective* price costs:
+
+```
+40,000 × 45,047 × 0.001 gwei × $2,509.38 = $4.52/day = $135.64/30-day month
+```
+
+For example, reducing an actually-paid 0.020 gwei to 0.006 gwei would save
+about $1,899/month. Verify that from receipts first—`maxFeePerGas` is a cap,
+not necessarily what was paid.
+
+Implemented: `npm run fees:base` samples Base `eth_feeHistory`, current base
+fee, and `eth_gasPrice` at submission time and emits `maxFeePerGas` plus
+`maxPriorityFeePerGas`. Wire those returned wei values into the relayer's
+transaction request; do not hard-code a mainnet tip or copy a past Base value.
+Set `FEE_URGENCY` to `economical`, `standard` (default), or `urgent`.
+
+### 3. Do not add per-payment approvals or a `transferFrom` batcher — avoids up to $815/month of self-inflicted spend
+
+The relayer currently sends its own ERC-20 transfers. Keep that model or fund
+the batch contract once. A design that calls `approve` and then
+`transferFrom` for each payment adds another transaction-shaped operation per
+payment and largely defeats batching. If an approval were being sent once for
+every current payment, the order of magnitude is another current transfer run
+rate: about $27/day / $815 per 30-day month. This is a design guardrail, not a
+claimed existing saving; no approvals were provided to measure.
+
+### 4. Do not chase calldata micro-optimizations before measuring them — no material demonstrated saving
+
+A direct ERC-20 `transfer(address,uint256)` already has fixed, compact ABI
+calldata. The live receipt's L1 fee was $0.00000116, so even eliminating all of
+that impossible-to-eliminate fee would save only about $1.39/month at this
+volume. Recipient and amount data are required in a batch too. Measure actual
+batch receipts before changing encodings or token interfaces.
+
+## Shipping checklist
+
+1. Export one normal day of successful relayer transaction hashes and retain the
+   JSON output of `npm run costs:base -- tx-hashes.txt` as Finance's baseline.
+2. Integrate `npm run fees:base`'s wei values in the submission path and alert
+   on effective gas price above the chosen envelope.
+3. Deploy `BatchPayer` first on testnet with the exact production token; test
+   normal, duplicate, zero-amount, and failed-token behaviors, then measure
+   Base receipts for 1, 10, 50, and 100 recipients.
+4. Have the contract reviewed, place ownership in the production custody
+   arrangement, fund a small capped float, and canary a small percentage of
+   payments. Reconcile every `BatchPaid` event with recipient token balance
+   changes before increasing the batch share.
+5. Recompute this ranking weekly from receipts. Gas price and ETH/USD are
+   variable; the code intentionally reads both at run time.
+
+## Verification performed
+
+`forge test --gas-report` passes: 4 tests, including the 100-recipient batch.
+The live receipt reporter and fee-policy command were both run successfully
+against Base mainnet.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d49ff3bb1559f3ad4dc501e69e40b12b4b298640
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..0dd8e7e4d4cd750f53aea4d43e41213a85e7a9cd
--- a/package.json
+++ b/package.json
@@ -1,4 +1,9 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "scripts": {
+    "fees:base": "node scripts/base-fee-policy.mjs",
+    "costs:base": "node scripts/relayer-cost-report.mjs",
+    "test": "forge test"
+  }
 }
diff --git a/scripts/base-fee-policy.mjs b/scripts/base-fee-policy.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..aa802605fac580e50d13d3d50ba43238353bacbf
--- /dev/null
+++ b/scripts/base-fee-policy.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+
+// Gets current Base fee data at submission time. It intentionally does not use
+// a copied mainnet priority fee or a static gwei constant.
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const urgency = process.env.FEE_URGENCY ?? "standard";
+const percentile = { economical: 25, standard: 50, urgent: 90 }[urgency];
+if (percentile === undefined) throw new Error("FEE_URGENCY must be economical, standard, or urgent");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const [latest, history, suggestedGasPrice] = await Promise.all([
+  rpc("eth_getBlockByNumber", ["latest", false]),
+  rpc("eth_feeHistory", ["0x5", "latest", [percentile]]),
+  rpc("eth_gasPrice", []),
+]);
+const toBigInt = (hex) => BigInt(hex);
+const baseFee = toBigInt(latest.baseFeePerGas);
+const rewards = history.reward.map((row) => toBigInt(row[0]));
+const priorityFee = rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[Math.floor(rewards.length / 2)];
+// Two blocks of base-fee headroom avoids a replacement storm while retaining a
+// current-chain derived cap. Base may enforce a network minimum gas price, so
+// never set a cap below its current suggestion.
+const maxFeePerGas = [baseFee * 2n + priorityFee, toBigInt(suggestedGasPrice)].reduce((a, b) => a > b ? a : b);
+
+const asGwei = (value) => Number(value) / 1e9;
+console.log(JSON.stringify({
+  chainId: 8453,
+  sampledAt: new Date().toISOString(),
+  urgency,
+  baseFeePerGasWei: baseFee.toString(),
+  maxPriorityFeePerGasWei: priorityFee.toString(),
+  maxFeePerGasWei: maxFeePerGas.toString(),
+  suggestedGasPriceWei: suggestedGasPrice,
+  displayGwei: {
+    baseFee: asGwei(baseFee),
+    maxPriorityFee: asGwei(priorityFee),
+    maxFee: asGwei(maxFeePerGas),
+  },
+}, null, 2));
diff --git a/scripts/relayer-cost-report.mjs b/scripts/relayer-cost-report.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..09ece32cc1fa74432fe6bccad637bd31bbd6ff86
--- /dev/null
+++ b/scripts/relayer-cost-report.mjs
@@ -0,0 +1,63 @@
+#!/usr/bin/env node
+
+// Usage: node scripts/relayer-cost-report.mjs tx-hashes.txt
+// The input is one Base transaction hash per line. Export these from the
+// relayer database; public Base RPCs cannot efficiently query by sender.
+import { readFile } from "node:fs/promises";
+
+const hashesFile = process.argv[2];
+if (!hashesFile) throw new Error("Usage: node scripts/relayer-cost-report.mjs tx-hashes.txt");
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const hashes = (await readFile(hashesFile, "utf8"))
+  .split(/\s+/)
+  .filter(Boolean)
+  .filter((hash, index, all) => all.indexOf(hash) === index);
+if (hashes.length === 0) throw new Error("No transaction hashes found");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const priceResponse = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot");
+if (!priceResponse.ok) throw new Error("Could not fetch ETH/USD spot price");
+const ethUsd = Number((await priceResponse.json()).data.amount);
+const receipts = [];
+// Keep requests bounded so this can run against conservative public RPC limits.
+for (let i = 0; i < hashes.length; i += 20) {
+  const group = hashes.slice(i, i + 20);
+  receipts.push(...await Promise.all(group.map((hash) => rpc("eth_getTransactionReceipt", [hash]))));
+}
+
+let executionWei = 0n;
+let l1Wei = 0n;
+for (let i = 0; i < receipts.length; ++i) {
+  const receipt = receipts[i];
+  if (!receipt) throw new Error(`Receipt not found: ${hashes[i]}`);
+  executionWei += BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice);
+  // OP-stack receipts expose l1Fee. Treat its absence as zero, but surface it
+  // so a provider schema change cannot silently be mistaken for a saving.
+  l1Wei += receipt.l1Fee ? BigInt(receipt.l1Fee) : 0n;
+}
+const totalWei = executionWei + l1Wei;
+const weiToEth = (value) => Number(value) / 1e18;
+const usd = (value) => weiToEth(value) * ethUsd;
+console.log(JSON.stringify({
+  chainId: 8453,
+  transactions: receipts.length,
+  ethUsd,
+  executionWei: executionWei.toString(),
+  l1DataWei: l1Wei.toString(),
+  totalWei: totalWei.toString(),
+  executionUsd: usd(executionWei),
+  l1DataUsd: usd(l1Wei),
+  totalUsd: usd(totalWei),
+  averageUsdPerTransaction: usd(totalWei) / receipts.length,
+  receiptsWithoutL1Fee: receipts.filter((receipt) => !receipt.l1Fee).length,
+}, null, 2));
diff --git a/src/BatchPayer.sol b/src/BatchPayer.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f61adeab92414abbddee11967b9b01dc3e7bc94
--- /dev/null
+++ b/src/BatchPayer.sol
@@ -0,0 +1,72 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Holds payment tokens and distributes them in one transaction.
+/// @dev Fund this contract directly. Do not use `transferFrom` for every
+/// recipient: the allowance update and extra call remove much of the benefit.
+contract BatchPayer {
+    error Unauthorized();
+    error ReentrantCall();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error TokenTransferFailed(uint256 index);
+
+    uint256 public constant MAX_RECIPIENTS = 200;
+
+    address public immutable owner;
+    uint256 private locked = 1;
+
+    event BatchPaid(address indexed token, uint256 recipients, uint256 total);
+
+    constructor(address owner_) {
+        if (owner_ == address(0)) revert Unauthorized();
+        owner = owner_;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    /// @notice Pays every recipient from this contract's balance.
+    /// @dev Supports ERC-20s that either return true or return no value.
+    function pay(
+        address token,
+        address[] calldata recipients,
+        uint256[] calldata amounts
+    ) external onlyOwner nonReentrant {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_RECIPIENTS) revert BatchTooLarge();
+
+        uint256 total;
+        for (uint256 i; i < length; ++i) {
+            total += amounts[i];
+            _safeTransfer(token, recipients[i], amounts[i], i);
+        }
+        emit BatchPaid(token, length, total);
+    }
+
+    /// @notice Lets the owner recover a token after a failed or retired campaign.
+    function recover(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
+        _safeTransfer(token, recipient, amount, type(uint256).max);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount, uint256 index) private {
+        (bool ok, bytes memory result) = token.call(
+            abi.encodeWithSelector(0xa9059cbb, recipient, amount)
+        );
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
+            revert TokenTransferFailed(index);
+        }
+    }
+}
diff --git a/src/MockERC20.sol b/src/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb8a06b96f4fe162571487dcac3de39faff74b80
--- /dev/null
+++ b/src/MockERC20.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    constructor(address initialHolder, uint256 supply) {
+        balanceOf[initialHolder] = supply;
+    }
+
+    function transfer(address recipient, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[recipient] += amount;
+        return true;
+    }
+}
diff --git a/test/BatchPayer.t.sol b/test/BatchPayer.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a69fbb133ffa2fae928f964b5904de765df64db9
--- /dev/null
+++ b/test/BatchPayer.t.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {BatchPayer} from "../src/BatchPayer.sol";
+import {MockERC20} from "../src/MockERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+}
+
+contract BatchPayerTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant RECIPIENT_A = address(0xB0B);
+    address private constant RECIPIENT_B = address(0xCA01);
+    address private constant RECIPIENT_C = address(0xD0D);
+
+    BatchPayer private payer;
+    MockERC20 private token;
+
+    function setUp() public {
+        payer = new BatchPayer(OWNER);
+        token = new MockERC20(address(payer), 1_000_000);
+    }
+
+    function testPaysBatch() public {
+        address[] memory recipients = new address[](3);
+        recipients[0] = RECIPIENT_A;
+        recipients[1] = RECIPIENT_B;
+        recipients[2] = RECIPIENT_C;
+        uint256[] memory amounts = new uint256[](3);
+        amounts[0] = 11;
+        amounts[1] = 22;
+        amounts[2] = 33;
+
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+
+        require(token.balanceOf(RECIPIENT_A) == 11, "recipient A not paid");
+        require(token.balanceOf(RECIPIENT_B) == 22, "recipient B not paid");
+        require(token.balanceOf(RECIPIENT_C) == 33, "recipient C not paid");
+    }
+
+    function testRejectsNonOwner() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = RECIPIENT_A;
+        uint256[] memory amounts = new uint256[](1);
+        amounts[0] = 1;
+        (bool ok,) = address(payer).call(
+            abi.encodeCall(BatchPayer.pay, (address(token), recipients, amounts))
+        );
+        require(!ok, "non-owner paid");
+    }
+
+    // This is deliberately separate from the batch test so `forge test
+    // --gas-report` records the cost of the ordinary ERC-20 transfer too.
+    function testDirectTransfersBaseline() public {
+        MockERC20 directToken = new MockERC20(OWNER, 1_000_000);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_A, 11);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_B, 22);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_C, 33);
+    }
+
+    function testPaysHundredRecipients() public {
+        address[] memory recipients = new address[](100);
+        uint256[] memory amounts = new uint256[](100);
+        for (uint256 i; i < 100; ++i) {
+            recipients[i] = address(uint160(i + 0x1000));
+            amounts[i] = 1;
+        }
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+        require(token.balanceOf(recipients[99]) == 1, "last recipient not paid");
+    }
+}

diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..1dd568ea611b9f50f6c959e0a9f899eb992fe89d
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,126 @@
+# Base relayer gas plan
+
+## Current run rate
+
+This is a live, reproducible point-in-time estimate, not a stale gas-price
+assumption. On 2026-08-28 00:02 UTC, a confirmed plain Base USDC transfer
+(`0x0e4ffb9e73f39bb860ead1616795a8dc480ec8e856209034ceb97b462f863c4b`)
+had these receipt fields:
+
+| Component | Measured amount | Cost at ETH = $2,509.38 |
+| --- | ---: | ---: |
+| L2 execution | 45,047 gas × 0.006 gwei = 270,282,000,000 wei | $0.00067824 |
+| L1 data fee | 462,707,932 wei | $0.00000116 |
+| **One payment** | **270,744,707,932 wei** | **$0.00067940** |
+| **40,000 payments/day** | — | **$27.18/day** |
+| **30-day month** | — | **$815.28/month** |
+| **365-day year** | — | **$9,919.26/year** |
+
+Formula: `gasUsed × effectiveGasPrice + l1Fee`; USD is the result in ETH
+multiplied by live ETH/USD. The L1 fee is only 0.17% of this sample, so Base
+execution gas—not data availability—is the meaningful lever today. Values move
+with the receipt and ETH/USD price.
+
+Run `npm run costs:base -- tx-hashes.txt` against a daily export of relayer
+transaction hashes. It calculates the actual total and explicitly includes the
+OP-stack `l1Fee`; use that report for Finance's ledger rather than extrapolating
+this one transaction forever.
+
+## Ranked actions
+
+### 1. Ship batched payouts in groups of 100 — estimated $397/month saved
+
+This is the largest known saving. Instead of 100 externally submitted ERC-20
+transactions, submit one transaction that calls the token 100 times from a
+funded payout contract.
+
+The included local benchmark, using new recipient balances (the expensive common
+case), measured 2,519,396 gas for `BatchPayer.pay` with 100 recipients. The
+same mock token's standalone `transfer` is 49,230 gas, or 4,923,000 gas for
+100 payments. That is a 48.82% execution-gas reduction:
+
+```
+daily execution spend     = 40,000 × 45,047 × 0.006 gwei × $2,509.38 = $27.13
+estimated daily saving    = $27.13 × 48.82% = $13.24
+estimated 30-day saving   = $397.25
+estimated annual saving   = $4,833
+```
+
+The estimate deliberately does **not** take a saving on L1 data fees. Before
+rollout, deploy on Base testnet, run the actual token and representative
+recipient mix through `eth_estimateGas`, and replace the 48.82% benchmark with
+the measured total including `l1Fee`. Use an initial 100-recipient batch; the
+contract permits at most 200 only as a safety ceiling, not a default.
+
+Operational trade-off: this requires prefunding the contract, rather than
+holding tokens in the relayer EOA. That changes custody and must get a security
+review, monitoring, and a staged rollout. It also assumes a conventional ERC-20
+that returns `true` or no return value; fee-on-transfer/rebasing tokens require
+token-specific payment reconciliation. The deploy itself is negligible at the
+observed price: 403,447 gas × 0.006 gwei × $2,509.38 = about $0.006.
+
+Implemented: `src/BatchPayer.sol`, with owner-only payments, token-transfer
+checks, a reentrancy guard, recovery, and a 200-recipient ceiling. Tests cover
+normal payments, access control, and the 100-recipient case.
+
+### 2. Derive EIP-1559 fees from Base immediately before submission — $0 now; $135/month per excess 0.001 gwei eliminated
+
+The live Base RPC at the measurement time reported a 0.005 gwei base fee and
+0.006 gwei suggested gas price. If the relayer already lands at that effective
+price, this change saves no money today; it prevents an accidental overbid.
+
+At this workload, every **0.001 gwei** of avoidable *effective* price costs:
+
+```
+40,000 × 45,047 × 0.001 gwei × $2,509.38 = $4.52/day = $135.64/30-day month
+```
+
+For example, reducing an actually-paid 0.020 gwei to 0.006 gwei would save
+about $1,899/month. Verify that from receipts first—`maxFeePerGas` is a cap,
+not necessarily what was paid.
+
+Implemented: `npm run fees:base` samples Base `eth_feeHistory`, current base
+fee, and `eth_gasPrice` at submission time and emits `maxFeePerGas` plus
+`maxPriorityFeePerGas`. Wire those returned wei values into the relayer's
+transaction request; do not hard-code a mainnet tip or copy a past Base value.
+Set `FEE_URGENCY` to `economical`, `standard` (default), or `urgent`.
+
+### 3. Do not add per-payment approvals or a `transferFrom` batcher — avoids up to $815/month of self-inflicted spend
+
+The relayer currently sends its own ERC-20 transfers. Keep that model or fund
+the batch contract once. A design that calls `approve` and then
+`transferFrom` for each payment adds another transaction-shaped operation per
+payment and largely defeats batching. If an approval were being sent once for
+every current payment, the order of magnitude is another current transfer run
+rate: about $27/day / $815 per 30-day month. This is a design guardrail, not a
+claimed existing saving; no approvals were provided to measure.
+
+### 4. Do not chase calldata micro-optimizations before measuring them — no material demonstrated saving
+
+A direct ERC-20 `transfer(address,uint256)` already has fixed, compact ABI
+calldata. The live receipt's L1 fee was $0.00000116, so even eliminating all of
+that impossible-to-eliminate fee would save only about $1.39/month at this
+volume. Recipient and amount data are required in a batch too. Measure actual
+batch receipts before changing encodings or token interfaces.
+
+## Shipping checklist
+
+1. Export one normal day of successful relayer transaction hashes and retain the
+   JSON output of `npm run costs:base -- tx-hashes.txt` as Finance's baseline.
+2. Integrate `npm run fees:base`'s wei values in the submission path and alert
+   on effective gas price above the chosen envelope.
+3. Deploy `BatchPayer` first on testnet with the exact production token; test
+   normal, duplicate, zero-amount, and failed-token behaviors, then measure
+   Base receipts for 1, 10, 50, and 100 recipients.
+4. Have the contract reviewed, place ownership in the production custody
+   arrangement, fund a small capped float, and canary a small percentage of
+   payments. Reconcile every `BatchPaid` event with recipient token balance
+   changes before increasing the batch share.
+5. Recompute this ranking weekly from receipts. Gas price and ETH/USD are
+   variable; the code intentionally reads both at run time.
+
+## Verification performed
+
+`forge test --gas-report` passes: 4 tests, including the 100-recipient batch.
+The live receipt reporter and fee-policy command were both run successfully
+against Base mainnet.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d49ff3bb1559f3ad4dc501e69e40b12b4b298640
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..0dd8e7e4d4cd750f53aea4d43e41213a85e7a9cd
--- a/package.json
+++ b/package.json
@@ -1,4 +1,9 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "scripts": {
+    "fees:base": "node scripts/base-fee-policy.mjs",
+    "costs:base": "node scripts/relayer-cost-report.mjs",
+    "test": "forge test"
+  }
 }
diff --git a/scripts/base-fee-policy.mjs b/scripts/base-fee-policy.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..aa802605fac580e50d13d3d50ba43238353bacbf
--- /dev/null
+++ b/scripts/base-fee-policy.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+
+// Gets current Base fee data at submission time. It intentionally does not use
+// a copied mainnet priority fee or a static gwei constant.
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const urgency = process.env.FEE_URGENCY ?? "standard";
+const percentile = { economical: 25, standard: 50, urgent: 90 }[urgency];
+if (percentile === undefined) throw new Error("FEE_URGENCY must be economical, standard, or urgent");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const [latest, history, suggestedGasPrice] = await Promise.all([
+  rpc("eth_getBlockByNumber", ["latest", false]),
+  rpc("eth_feeHistory", ["0x5", "latest", [percentile]]),
+  rpc("eth_gasPrice", []),
+]);
+const toBigInt = (hex) => BigInt(hex);
+const baseFee = toBigInt(latest.baseFeePerGas);
+const rewards = history.reward.map((row) => toBigInt(row[0]));
+const priorityFee = rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[Math.floor(rewards.length / 2)];
+// Two blocks of base-fee headroom avoids a replacement storm while retaining a
+// current-chain derived cap. Base may enforce a network minimum gas price, so
+// never set a cap below its current suggestion.
+const maxFeePerGas = [baseFee * 2n + priorityFee, toBigInt(suggestedGasPrice)].reduce((a, b) => a > b ? a : b);
+
+const asGwei = (value) => Number(value) / 1e9;
+console.log(JSON.stringify({
+  chainId: 8453,
+  sampledAt: new Date().toISOString(),
+  urgency,
+  baseFeePerGasWei: baseFee.toString(),
+  maxPriorityFeePerGasWei: priorityFee.toString(),
+  maxFeePerGasWei: maxFeePerGas.toString(),
+  suggestedGasPriceWei: suggestedGasPrice,
+  displayGwei: {
+    baseFee: asGwei(baseFee),
+    maxPriorityFee: asGwei(priorityFee),
+    maxFee: asGwei(maxFeePerGas),
+  },
+}, null, 2));
diff --git a/scripts/relayer-cost-report.mjs b/scripts/relayer-cost-report.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..09ece32cc1fa74432fe6bccad637bd31bbd6ff86
--- /dev/null
+++ b/scripts/relayer-cost-report.mjs
@@ -0,0 +1,63 @@
+#!/usr/bin/env node
+
+// Usage: node scripts/relayer-cost-report.mjs tx-hashes.txt
+// The input is one Base transaction hash per line. Export these from the
+// relayer database; public Base RPCs cannot efficiently query by sender.
+import { readFile } from "node:fs/promises";
+
+const hashesFile = process.argv[2];
+if (!hashesFile) throw new Error("Usage: node scripts/relayer-cost-report.mjs tx-hashes.txt");
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const hashes = (await readFile(hashesFile, "utf8"))
+  .split(/\s+/)
+  .filter(Boolean)
+  .filter((hash, index, all) => all.indexOf(hash) === index);
+if (hashes.length === 0) throw new Error("No transaction hashes found");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const priceResponse = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot");
+if (!priceResponse.ok) throw new Error("Could not fetch ETH/USD spot price");
+const ethUsd = Number((await priceResponse.json()).data.amount);
+const receipts = [];
+// Keep requests bounded so this can run against conservative public RPC limits.
+for (let i = 0; i < hashes.length; i += 20) {
+  const group = hashes.slice(i, i + 20);
+  receipts.push(...await Promise.all(group.map((hash) => rpc("eth_getTransactionReceipt", [hash]))));
+}
+
+let executionWei = 0n;
+let l1Wei = 0n;
+for (let i = 0; i < receipts.length; ++i) {
+  const receipt = receipts[i];
+  if (!receipt) throw new Error(`Receipt not found: ${hashes[i]}`);
+  executionWei += BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice);
+  // OP-stack receipts expose l1Fee. Treat its absence as zero, but surface it
+  // so a provider schema change cannot silently be mistaken for a saving.
+  l1Wei += receipt.l1Fee ? BigInt(receipt.l1Fee) : 0n;
+}
+const totalWei = executionWei + l1Wei;
+const weiToEth = (value) => Number(value) / 1e18;
+const usd = (value) => weiToEth(value) * ethUsd;
+console.log(JSON.stringify({
+  chainId: 8453,
+  transactions: receipts.length,
+  ethUsd,
+  executionWei: executionWei.toString(),
+  l1DataWei: l1Wei.toString(),
+  totalWei: totalWei.toString(),
+  executionUsd: usd(executionWei),
+  l1DataUsd: usd(l1Wei),
+  totalUsd: usd(totalWei),
+  averageUsdPerTransaction: usd(totalWei) / receipts.length,
+  receiptsWithoutL1Fee: receipts.filter((receipt) => !receipt.l1Fee).length,
+}, null, 2));
diff --git a/src/BatchPayer.sol b/src/BatchPayer.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f61adeab92414abbddee11967b9b01dc3e7bc94
--- /dev/null
+++ b/src/BatchPayer.sol
@@ -0,0 +1,72 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Holds payment tokens and distributes them in one transaction.
+/// @dev Fund this contract directly. Do not use `transferFrom` for every
+/// recipient: the allowance update and extra call remove much of the benefit.
+contract BatchPayer {
+    error Unauthorized();
+    error ReentrantCall();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error TokenTransferFailed(uint256 index);
+
+    uint256 public constant MAX_RECIPIENTS = 200;
+
+    address public immutable owner;
+    uint256 private locked = 1;
+
+    event BatchPaid(address indexed token, uint256 recipients, uint256 total);
+
+    constructor(address owner_) {
+        if (owner_ == address(0)) revert Unauthorized();
+        owner = owner_;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    /// @notice Pays every recipient from this contract's balance.
+    /// @dev Supports ERC-20s that either return true or return no value.
+    function pay(
+        address token,
+        address[] calldata recipients,
+        uint256[] calldata amounts
+    ) external onlyOwner nonReentrant {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_RECIPIENTS) revert BatchTooLarge();
+
+        uint256 total;
+        for (uint256 i; i < length; ++i) {
+            total += amounts[i];
+            _safeTransfer(token, recipients[i], amounts[i], i);
+        }
+        emit BatchPaid(token, length, total);
+    }
+
+    /// @notice Lets the owner recover a token after a failed or retired campaign.
+    function recover(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
+        _safeTransfer(token, recipient, amount, type(uint256).max);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount, uint256 index) private {
+        (bool ok, bytes memory result) = token.call(
+            abi.encodeWithSelector(0xa9059cbb, recipient, amount)
+        );
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
+            revert TokenTransferFailed(index);
+        }
+    }
+}
diff --git a/src/MockERC20.sol b/src/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb8a06b96f4fe162571487dcac3de39faff74b80
--- /dev/null
+++ b/src/MockERC20.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    constructor(address initialHolder, uint256 supply) {
+        balanceOf[initialHolder] = supply;
+    }
+
+    function transfer(address recipient, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[recipient] += amount;
+        return true;
+    }
+}
diff --git a/test/BatchPayer.t.sol b/test/BatchPayer.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a69fbb133ffa2fae928f964b5904de765df64db9
--- /dev/null
+++ b/test/BatchPayer.t.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {BatchPayer} from "../src/BatchPayer.sol";
+import {MockERC20} from "../src/MockERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+}
+
+contract BatchPayerTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant RECIPIENT_A = address(0xB0B);
+    address private constant RECIPIENT_B = address(0xCA01);
+    address private constant RECIPIENT_C = address(0xD0D);
+
+    BatchPayer private payer;
+    MockERC20 private token;
+
+    function setUp() public {
+        payer = new BatchPayer(OWNER);
+        token = new MockERC20(address(payer), 1_000_000);
+    }
+
+    function testPaysBatch() public {
+        address[] memory recipients = new address[](3);
+        recipients[0] = RECIPIENT_A;
+        recipients[1] = RECIPIENT_B;
+        recipients[2] = RECIPIENT_C;
+        uint256[] memory amounts = new uint256[](3);
+        amounts[0] = 11;
+        amounts[1] = 22;
+        amounts[2] = 33;
+
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+
+        require(token.balanceOf(RECIPIENT_A) == 11, "recipient A not paid");
+        require(token.balanceOf(RECIPIENT_B) == 22, "recipient B not paid");
+        require(token.balanceOf(RECIPIENT_C) == 33, "recipient C not paid");
+    }
+
+    function testRejectsNonOwner() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = RECIPIENT_A;
+        uint256[] memory amounts = new uint256[](1);
+        amounts[0] = 1;
+        (bool ok,) = address(payer).call(
+            abi.encodeCall(BatchPayer.pay, (address(token), recipients, amounts))
+        );
+        require(!ok, "non-owner paid");
+    }
+
+    // This is deliberately separate from the batch test so `forge test
+    // --gas-report` records the cost of the ordinary ERC-20 transfer too.
+    function testDirectTransfersBaseline() public {
+        MockERC20 directToken = new MockERC20(OWNER, 1_000_000);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_A, 11);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_B, 22);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_C, 33);
+    }
+
+    function testPaysHundredRecipients() public {
+        address[] memory recipients = new address[](100);
+        uint256[] memory amounts = new uint256[](100);
+        for (uint256 i; i < 100; ++i) {
+            recipients[i] = address(uint160(i + 0x1000));
+            amounts[i] = 1;
+        }
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+        require(token.balanceOf(recipients[99]) == 1, "last recipient not paid");
+    }
+}

exec
/bin/bash -lc "node - <<'NODE'
const per=0.0006794013551904022, execution=0.00067824024516;
for (const n of [40000,40000*30,40000*365]) console.log(n, per*n);
console.log('saving day',40000*execution*.4882,'month',40000*execution*.4882*30,'year',40000*execution*.4882*365);
console.log('excess',40000*45047*.001e-9*2509.38,40000*45047*.001e-9*2509.38*30)
NODE
forge test --gas-report >/tmp/gas-goal-test.log && tail -45 /tmp/gas-goal-test.log
git diff --check
git status --short" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002
 succeeded in 81ms:
40000 27.176054207616087
1200000 815.2816262284827
14600000 9919.259785779872
saving day 13.244675507484482 month 397.34026522453445 year 4834.306560231836
excess 4.5216016344000005 135.64804903200002
No files changed, compilation skipped

Ran 4 tests for test/BatchPayer.t.sol:BatchPayerTest
[PASS] testDirectTransfersBaseline() (gas: 358699)
[PASS] testPaysBatch() (gas: 135666)
[PASS] testPaysHundredRecipients() (gas: 2577733)
[PASS] testRejectsNonOwner() (gas: 32033)
Suite result: ok. 4 passed; 0 failed; 0 skipped; finished in 2.25ms (2.58ms CPU time)

╭----------------------------------------+-----------------+--------+--------+---------+---------╮
| src/BatchPayer.sol:BatchPayer Contract |                 |        |        |         |         |
+================================================================================================+
| Deployment Cost                        | Deployment Size |        |        |         |         |
|----------------------------------------+-----------------+--------+--------+---------+---------|
| 403447                                 | 1727            |        |        |         |         |
|----------------------------------------+-----------------+--------+--------+---------+---------|
|                                        |                 |        |        |         |         |
|----------------------------------------+-----------------+--------+--------+---------+---------|
| Function Name                          | Min             | Avg    | Median | Max     | # Calls |
|----------------------------------------+-----------------+--------+--------+---------+---------|
| pay                                    | 23179           | 883818 | 108881 | 2519396 | 3       |
╰----------------------------------------+-----------------+--------+--------+---------+---------╯

╭--------------------------------------+-----------------+-------+--------+-------+---------╮
| src/MockERC20.sol:MockERC20 Contract |                 |       |        |       |         |
+===========================================================================================+
| Deployment Cost                      | Deployment Size |       |        |       |         |
|--------------------------------------+-----------------+-------+--------+-------+---------|
| 173983                               | 652             |       |        |       |         |
|--------------------------------------+-----------------+-------+--------+-------+---------|
|                                      |                 |       |        |       |         |
|--------------------------------------+-----------------+-------+--------+-------+---------|
| Function Name                        | Min             | Avg   | Median | Max   | # Calls |
|--------------------------------------+-----------------+-------+--------+-------+---------|
| balanceOf                            | 2486            | 2486  | 2486   | 2486  | 4       |
|--------------------------------------+-----------------+-------+--------+-------+---------|
| transfer                             | 49230           | 49230 | 49230  | 49230 | 3       |
╰--------------------------------------+-----------------+-------+--------+-------+---------╯


Ran 1 test suite in 3.01ms (2.25ms CPU time): 4 tests passed, 0 failed, 0 skipped (4 total tests)
 M package.json
?? PLAN.md
?? foundry.toml
?? scripts/
?? src/
?? test/

diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..1dd568ea611b9f50f6c959e0a9f899eb992fe89d
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,126 @@
+# Base relayer gas plan
+
+## Current run rate
+
+This is a live, reproducible point-in-time estimate, not a stale gas-price
+assumption. On 2026-08-28 00:02 UTC, a confirmed plain Base USDC transfer
+(`0x0e4ffb9e73f39bb860ead1616795a8dc480ec8e856209034ceb97b462f863c4b`)
+had these receipt fields:
+
+| Component | Measured amount | Cost at ETH = $2,509.38 |
+| --- | ---: | ---: |
+| L2 execution | 45,047 gas × 0.006 gwei = 270,282,000,000 wei | $0.00067824 |
+| L1 data fee | 462,707,932 wei | $0.00000116 |
+| **One payment** | **270,744,707,932 wei** | **$0.00067940** |
+| **40,000 payments/day** | — | **$27.18/day** |
+| **30-day month** | — | **$815.28/month** |
+| **365-day year** | — | **$9,919.26/year** |
+
+Formula: `gasUsed × effectiveGasPrice + l1Fee`; USD is the result in ETH
+multiplied by live ETH/USD. The L1 fee is only 0.17% of this sample, so Base
+execution gas—not data availability—is the meaningful lever today. Values move
+with the receipt and ETH/USD price.
+
+Run `npm run costs:base -- tx-hashes.txt` against a daily export of relayer
+transaction hashes. It calculates the actual total and explicitly includes the
+OP-stack `l1Fee`; use that report for Finance's ledger rather than extrapolating
+this one transaction forever.
+
+## Ranked actions
+
+### 1. Ship batched payouts in groups of 100 — estimated $397/month saved
+
+This is the largest known saving. Instead of 100 externally submitted ERC-20
+transactions, submit one transaction that calls the token 100 times from a
+funded payout contract.
+
+The included local benchmark, using new recipient balances (the expensive common
+case), measured 2,519,396 gas for `BatchPayer.pay` with 100 recipients. The
+same mock token's standalone `transfer` is 49,230 gas, or 4,923,000 gas for
+100 payments. That is a 48.82% execution-gas reduction:
+
+```
+daily execution spend     = 40,000 × 45,047 × 0.006 gwei × $2,509.38 = $27.13
+estimated daily saving    = $27.13 × 48.82% = $13.24
+estimated 30-day saving   = $397.25
+estimated annual saving   = $4,833
+```
+
+The estimate deliberately does **not** take a saving on L1 data fees. Before
+rollout, deploy on Base testnet, run the actual token and representative
+recipient mix through `eth_estimateGas`, and replace the 48.82% benchmark with
+the measured total including `l1Fee`. Use an initial 100-recipient batch; the
+contract permits at most 200 only as a safety ceiling, not a default.
+
+Operational trade-off: this requires prefunding the contract, rather than
+holding tokens in the relayer EOA. That changes custody and must get a security
+review, monitoring, and a staged rollout. It also assumes a conventional ERC-20
+that returns `true` or no return value; fee-on-transfer/rebasing tokens require
+token-specific payment reconciliation. The deploy itself is negligible at the
+observed price: 403,447 gas × 0.006 gwei × $2,509.38 = about $0.006.
+
+Implemented: `src/BatchPayer.sol`, with owner-only payments, token-transfer
+checks, a reentrancy guard, recovery, and a 200-recipient ceiling. Tests cover
+normal payments, access control, and the 100-recipient case.
+
+### 2. Derive EIP-1559 fees from Base immediately before submission — $0 now; $135/month per excess 0.001 gwei eliminated
+
+The live Base RPC at the measurement time reported a 0.005 gwei base fee and
+0.006 gwei suggested gas price. If the relayer already lands at that effective
+price, this change saves no money today; it prevents an accidental overbid.
+
+At this workload, every **0.001 gwei** of avoidable *effective* price costs:
+
+```
+40,000 × 45,047 × 0.001 gwei × $2,509.38 = $4.52/day = $135.64/30-day month
+```
+
+For example, reducing an actually-paid 0.020 gwei to 0.006 gwei would save
+about $1,899/month. Verify that from receipts first—`maxFeePerGas` is a cap,
+not necessarily what was paid.
+
+Implemented: `npm run fees:base` samples Base `eth_feeHistory`, current base
+fee, and `eth_gasPrice` at submission time and emits `maxFeePerGas` plus
+`maxPriorityFeePerGas`. Wire those returned wei values into the relayer's
+transaction request; do not hard-code a mainnet tip or copy a past Base value.
+Set `FEE_URGENCY` to `economical`, `standard` (default), or `urgent`.
+
+### 3. Do not add per-payment approvals or a `transferFrom` batcher — avoids up to $815/month of self-inflicted spend
+
+The relayer currently sends its own ERC-20 transfers. Keep that model or fund
+the batch contract once. A design that calls `approve` and then
+`transferFrom` for each payment adds another transaction-shaped operation per
+payment and largely defeats batching. If an approval were being sent once for
+every current payment, the order of magnitude is another current transfer run
+rate: about $27/day / $815 per 30-day month. This is a design guardrail, not a
+claimed existing saving; no approvals were provided to measure.
+
+### 4. Do not chase calldata micro-optimizations before measuring them — no material demonstrated saving
+
+A direct ERC-20 `transfer(address,uint256)` already has fixed, compact ABI
+calldata. The live receipt's L1 fee was $0.00000116, so even eliminating all of
+that impossible-to-eliminate fee would save only about $1.39/month at this
+volume. Recipient and amount data are required in a batch too. Measure actual
+batch receipts before changing encodings or token interfaces.
+
+## Shipping checklist
+
+1. Export one normal day of successful relayer transaction hashes and retain the
+   JSON output of `npm run costs:base -- tx-hashes.txt` as Finance's baseline.
+2. Integrate `npm run fees:base`'s wei values in the submission path and alert
+   on effective gas price above the chosen envelope.
+3. Deploy `BatchPayer` first on testnet with the exact production token; test
+   normal, duplicate, zero-amount, and failed-token behaviors, then measure
+   Base receipts for 1, 10, 50, and 100 recipients.
+4. Have the contract reviewed, place ownership in the production custody
+   arrangement, fund a small capped float, and canary a small percentage of
+   payments. Reconcile every `BatchPaid` event with recipient token balance
+   changes before increasing the batch share.
+5. Recompute this ranking weekly from receipts. Gas price and ETH/USD are
+   variable; the code intentionally reads both at run time.
+
+## Verification performed
+
+`forge test --gas-report` passes: 4 tests, including the 100-recipient batch.
+The live receipt reporter and fee-policy command were both run successfully
+against Base mainnet.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d49ff3bb1559f3ad4dc501e69e40b12b4b298640
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..0dd8e7e4d4cd750f53aea4d43e41213a85e7a9cd
--- a/package.json
+++ b/package.json
@@ -1,4 +1,9 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "scripts": {
+    "fees:base": "node scripts/base-fee-policy.mjs",
+    "costs:base": "node scripts/relayer-cost-report.mjs",
+    "test": "forge test"
+  }
 }
diff --git a/scripts/base-fee-policy.mjs b/scripts/base-fee-policy.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..aa802605fac580e50d13d3d50ba43238353bacbf
--- /dev/null
+++ b/scripts/base-fee-policy.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+
+// Gets current Base fee data at submission time. It intentionally does not use
+// a copied mainnet priority fee or a static gwei constant.
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const urgency = process.env.FEE_URGENCY ?? "standard";
+const percentile = { economical: 25, standard: 50, urgent: 90 }[urgency];
+if (percentile === undefined) throw new Error("FEE_URGENCY must be economical, standard, or urgent");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const [latest, history, suggestedGasPrice] = await Promise.all([
+  rpc("eth_getBlockByNumber", ["latest", false]),
+  rpc("eth_feeHistory", ["0x5", "latest", [percentile]]),
+  rpc("eth_gasPrice", []),
+]);
+const toBigInt = (hex) => BigInt(hex);
+const baseFee = toBigInt(latest.baseFeePerGas);
+const rewards = history.reward.map((row) => toBigInt(row[0]));
+const priorityFee = rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[Math.floor(rewards.length / 2)];
+// Two blocks of base-fee headroom avoids a replacement storm while retaining a
+// current-chain derived cap. Base may enforce a network minimum gas price, so
+// never set a cap below its current suggestion.
+const maxFeePerGas = [baseFee * 2n + priorityFee, toBigInt(suggestedGasPrice)].reduce((a, b) => a > b ? a : b);
+
+const asGwei = (value) => Number(value) / 1e9;
+console.log(JSON.stringify({
+  chainId: 8453,
+  sampledAt: new Date().toISOString(),
+  urgency,
+  baseFeePerGasWei: baseFee.toString(),
+  maxPriorityFeePerGasWei: priorityFee.toString(),
+  maxFeePerGasWei: maxFeePerGas.toString(),
+  suggestedGasPriceWei: suggestedGasPrice,
+  displayGwei: {
+    baseFee: asGwei(baseFee),
+    maxPriorityFee: asGwei(priorityFee),
+    maxFee: asGwei(maxFeePerGas),
+  },
+}, null, 2));
diff --git a/scripts/relayer-cost-report.mjs b/scripts/relayer-cost-report.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..09ece32cc1fa74432fe6bccad637bd31bbd6ff86
--- /dev/null
+++ b/scripts/relayer-cost-report.mjs
@@ -0,0 +1,63 @@
+#!/usr/bin/env node
+
+// Usage: node scripts/relayer-cost-report.mjs tx-hashes.txt
+// The input is one Base transaction hash per line. Export these from the
+// relayer database; public Base RPCs cannot efficiently query by sender.
+import { readFile } from "node:fs/promises";
+
+const hashesFile = process.argv[2];
+if (!hashesFile) throw new Error("Usage: node scripts/relayer-cost-report.mjs tx-hashes.txt");
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const hashes = (await readFile(hashesFile, "utf8"))
+  .split(/\s+/)
+  .filter(Boolean)
+  .filter((hash, index, all) => all.indexOf(hash) === index);
+if (hashes.length === 0) throw new Error("No transaction hashes found");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const priceResponse = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot");
+if (!priceResponse.ok) throw new Error("Could not fetch ETH/USD spot price");
+const ethUsd = Number((await priceResponse.json()).data.amount);
+const receipts = [];
+// Keep requests bounded so this can run against conservative public RPC limits.
+for (let i = 0; i < hashes.length; i += 20) {
+  const group = hashes.slice(i, i + 20);
+  receipts.push(...await Promise.all(group.map((hash) => rpc("eth_getTransactionReceipt", [hash]))));
+}
+
+let executionWei = 0n;
+let l1Wei = 0n;
+for (let i = 0; i < receipts.length; ++i) {
+  const receipt = receipts[i];
+  if (!receipt) throw new Error(`Receipt not found: ${hashes[i]}`);
+  executionWei += BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice);
+  // OP-stack receipts expose l1Fee. Treat its absence as zero, but surface it
+  // so a provider schema change cannot silently be mistaken for a saving.
+  l1Wei += receipt.l1Fee ? BigInt(receipt.l1Fee) : 0n;
+}
+const totalWei = executionWei + l1Wei;
+const weiToEth = (value) => Number(value) / 1e18;
+const usd = (value) => weiToEth(value) * ethUsd;
+console.log(JSON.stringify({
+  chainId: 8453,
+  transactions: receipts.length,
+  ethUsd,
+  executionWei: executionWei.toString(),
+  l1DataWei: l1Wei.toString(),
+  totalWei: totalWei.toString(),
+  executionUsd: usd(executionWei),
+  l1DataUsd: usd(l1Wei),
+  totalUsd: usd(totalWei),
+  averageUsdPerTransaction: usd(totalWei) / receipts.length,
+  receiptsWithoutL1Fee: receipts.filter((receipt) => !receipt.l1Fee).length,
+}, null, 2));
diff --git a/src/BatchPayer.sol b/src/BatchPayer.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f61adeab92414abbddee11967b9b01dc3e7bc94
--- /dev/null
+++ b/src/BatchPayer.sol
@@ -0,0 +1,72 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Holds payment tokens and distributes them in one transaction.
+/// @dev Fund this contract directly. Do not use `transferFrom` for every
+/// recipient: the allowance update and extra call remove much of the benefit.
+contract BatchPayer {
+    error Unauthorized();
+    error ReentrantCall();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error TokenTransferFailed(uint256 index);
+
+    uint256 public constant MAX_RECIPIENTS = 200;
+
+    address public immutable owner;
+    uint256 private locked = 1;
+
+    event BatchPaid(address indexed token, uint256 recipients, uint256 total);
+
+    constructor(address owner_) {
+        if (owner_ == address(0)) revert Unauthorized();
+        owner = owner_;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    /// @notice Pays every recipient from this contract's balance.
+    /// @dev Supports ERC-20s that either return true or return no value.
+    function pay(
+        address token,
+        address[] calldata recipients,
+        uint256[] calldata amounts
+    ) external onlyOwner nonReentrant {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_RECIPIENTS) revert BatchTooLarge();
+
+        uint256 total;
+        for (uint256 i; i < length; ++i) {
+            total += amounts[i];
+            _safeTransfer(token, recipients[i], amounts[i], i);
+        }
+        emit BatchPaid(token, length, total);
+    }
+
+    /// @notice Lets the owner recover a token after a failed or retired campaign.
+    function recover(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
+        _safeTransfer(token, recipient, amount, type(uint256).max);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount, uint256 index) private {
+        (bool ok, bytes memory result) = token.call(
+            abi.encodeWithSelector(0xa9059cbb, recipient, amount)
+        );
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
+            revert TokenTransferFailed(index);
+        }
+    }
+}
diff --git a/src/MockERC20.sol b/src/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb8a06b96f4fe162571487dcac3de39faff74b80
--- /dev/null
+++ b/src/MockERC20.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    constructor(address initialHolder, uint256 supply) {
+        balanceOf[initialHolder] = supply;
+    }
+
+    function transfer(address recipient, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[recipient] += amount;
+        return true;
+    }
+}
diff --git a/test/BatchPayer.t.sol b/test/BatchPayer.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a69fbb133ffa2fae928f964b5904de765df64db9
--- /dev/null
+++ b/test/BatchPayer.t.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {BatchPayer} from "../src/BatchPayer.sol";
+import {MockERC20} from "../src/MockERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+}
+
+contract BatchPayerTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant RECIPIENT_A = address(0xB0B);
+    address private constant RECIPIENT_B = address(0xCA01);
+    address private constant RECIPIENT_C = address(0xD0D);
+
+    BatchPayer private payer;
+    MockERC20 private token;
+
+    function setUp() public {
+        payer = new BatchPayer(OWNER);
+        token = new MockERC20(address(payer), 1_000_000);
+    }
+
+    function testPaysBatch() public {
+        address[] memory recipients = new address[](3);
+        recipients[0] = RECIPIENT_A;
+        recipients[1] = RECIPIENT_B;
+        recipients[2] = RECIPIENT_C;
+        uint256[] memory amounts = new uint256[](3);
+        amounts[0] = 11;
+        amounts[1] = 22;
+        amounts[2] = 33;
+
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+
+        require(token.balanceOf(RECIPIENT_A) == 11, "recipient A not paid");
+        require(token.balanceOf(RECIPIENT_B) == 22, "recipient B not paid");
+        require(token.balanceOf(RECIPIENT_C) == 33, "recipient C not paid");
+    }
+
+    function testRejectsNonOwner() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = RECIPIENT_A;
+        uint256[] memory amounts = new uint256[](1);
+        amounts[0] = 1;
+        (bool ok,) = address(payer).call(
+            abi.encodeCall(BatchPayer.pay, (address(token), recipients, amounts))
+        );
+        require(!ok, "non-owner paid");
+    }
+
+    // This is deliberately separate from the batch test so `forge test
+    // --gas-report` records the cost of the ordinary ERC-20 transfer too.
+    function testDirectTransfersBaseline() public {
+        MockERC20 directToken = new MockERC20(OWNER, 1_000_000);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_A, 11);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_B, 22);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_C, 33);
+    }
+
+    function testPaysHundredRecipients() public {
+        address[] memory recipients = new address[](100);
+        uint256[] memory amounts = new uint256[](100);
+        for (uint256 i; i < 100; ++i) {
+            recipients[i] = address(uint160(i + 0x1000));
+            amounts[i] = 1;
+        }
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+        require(token.balanceOf(recipients[99]) == 1, "last recipient not paid");
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002/PLAN.md
diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..d73c73fc5861701cbf96dfefe2348421b0c82014
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,126 @@
+# Base relayer gas plan
+
+## Current run rate
+
+This is a live, reproducible point-in-time estimate, not a stale gas-price
+assumption. On 2026-08-28 00:02 UTC, a confirmed plain Base USDC transfer
+(`0x0e4ffb9e73f39bb860ead1616795a8dc480ec8e856209034ceb97b462f863c4b`)
+had these receipt fields:
+
+| Component | Measured amount | Cost at ETH = $2,509.38 |
+| --- | ---: | ---: |
+| L2 execution | 45,047 gas × 0.006 gwei = 270,282,000,000 wei | $0.00067824 |
+| L1 data fee | 462,707,932 wei | $0.00000116 |
+| **One payment** | **270,744,707,932 wei** | **$0.00067940** |
+| **40,000 payments/day** | — | **$27.18/day** |
+| **30-day month** | — | **$815.28/month** |
+| **365-day year** | — | **$9,919.26/year** |
+
+Formula: `gasUsed × effectiveGasPrice + l1Fee`; USD is the result in ETH
+multiplied by live ETH/USD. The L1 fee is only 0.17% of this sample, so Base
+execution gas—not data availability—is the meaningful lever today. Values move
+with the receipt and ETH/USD price.
+
+Run `npm run costs:base -- tx-hashes.txt` against a daily export of relayer
+transaction hashes. It calculates the actual total and explicitly includes the
+OP-stack `l1Fee`; use that report for Finance's ledger rather than extrapolating
+this one transaction forever.
+
+## Ranked actions
+
+### 1. Ship batched payouts in groups of 100 — estimated $397/month saved
+
+This is the largest known saving. Instead of 100 externally submitted ERC-20
+transactions, submit one transaction that calls the token 100 times from a
+funded payout contract.
+
+The included local benchmark, using new recipient balances (the expensive common
+case), measured 2,519,396 gas for `BatchPayer.pay` with 100 recipients. The
+same mock token's standalone `transfer` is 49,230 gas, or 4,923,000 gas for
+100 payments. That is a 48.82% execution-gas reduction:
+
+```
+daily execution spend     = 40,000 × 45,047 × 0.006 gwei × $2,509.38 = $27.13
+estimated daily saving    = $27.13 × 48.82% = $13.24
+estimated 30-day saving   = $397.34
+estimated annual saving   = $4,834
+```
+
+The estimate deliberately does **not** take a saving on L1 data fees. Before
+rollout, deploy on Base testnet, run the actual token and representative
+recipient mix through `eth_estimateGas`, and replace the 48.82% benchmark with
+the measured total including `l1Fee`. Use an initial 100-recipient batch; the
+contract permits at most 200 only as a safety ceiling, not a default.
+
+Operational trade-off: this requires prefunding the contract, rather than
+holding tokens in the relayer EOA. That changes custody and must get a security
+review, monitoring, and a staged rollout. It also assumes a conventional ERC-20
+that returns `true` or no return value; fee-on-transfer/rebasing tokens require
+token-specific payment reconciliation. The deploy itself is negligible at the
+observed price: 403,447 gas × 0.006 gwei × $2,509.38 = about $0.006.
+
+Implemented: `src/BatchPayer.sol`, with owner-only payments, token-transfer
+checks, a reentrancy guard, recovery, and a 200-recipient ceiling. Tests cover
+normal payments, access control, and the 100-recipient case.
+
+### 2. Derive EIP-1559 fees from Base immediately before submission — $0 now; $135/month per excess 0.001 gwei eliminated
+
+The live Base RPC at the measurement time reported a 0.005 gwei base fee and
+0.006 gwei suggested gas price. If the relayer already lands at that effective
+price, this change saves no money today; it prevents an accidental overbid.
+
+At this workload, every **0.001 gwei** of avoidable *effective* price costs:
+
+```
+40,000 × 45,047 × 0.001 gwei × $2,509.38 = $4.52/day = $135.64/30-day month
+```
+
+For example, reducing an actually-paid 0.020 gwei to 0.006 gwei would save
+about $1,899/month. Verify that from receipts first—`maxFeePerGas` is a cap,
+not necessarily what was paid.
+
+Implemented: `npm run fees:base` samples Base `eth_feeHistory`, current base
+fee, and `eth_gasPrice` at submission time and emits `maxFeePerGas` plus
+`maxPriorityFeePerGas`. Wire those returned wei values into the relayer's
+transaction request; do not hard-code a mainnet tip or copy a past Base value.
+Set `FEE_URGENCY` to `economical`, `standard` (default), or `urgent`.
+
+### 3. Do not add per-payment approvals or a `transferFrom` batcher — avoids up to $815/month of self-inflicted spend
+
+The relayer currently sends its own ERC-20 transfers. Keep that model or fund
+the batch contract once. A design that calls `approve` and then
+`transferFrom` for each payment adds another transaction-shaped operation per
+payment and largely defeats batching. If an approval were being sent once for
+every current payment, the order of magnitude is another current transfer run
+rate: about $27/day / $815 per 30-day month. This is a design guardrail, not a
+claimed existing saving; no approvals were provided to measure.
+
+### 4. Do not chase calldata micro-optimizations before measuring them — no material demonstrated saving
+
+A direct ERC-20 `transfer(address,uint256)` already has fixed, compact ABI
+calldata. The live receipt's L1 fee was $0.00000116, so even eliminating all of
+that impossible-to-eliminate fee would save only about $1.39/month at this
+volume. Recipient and amount data are required in a batch too. Measure actual
+batch receipts before changing encodings or token interfaces.
+
+## Shipping checklist
+
+1. Export one normal day of successful relayer transaction hashes and retain the
+   JSON output of `npm run costs:base -- tx-hashes.txt` as Finance's baseline.
+2. Integrate `npm run fees:base`'s wei values in the submission path and alert
+   on effective gas price above the chosen envelope.
+3. Deploy `BatchPayer` first on testnet with the exact production token; test
+   normal, duplicate, zero-amount, and failed-token behaviors, then measure
+   Base receipts for 1, 10, 50, and 100 recipients.
+4. Have the contract reviewed, place ownership in the production custody
+   arrangement, fund a small capped float, and canary a small percentage of
+   payments. Reconcile every `BatchPaid` event with recipient token balance
+   changes before increasing the batch share.
+5. Recompute this ranking weekly from receipts. Gas price and ETH/USD are
+   variable; the code intentionally reads both at run time.
+
+## Verification performed
+
+`forge test --gas-report` passes: 4 tests, including the 100-recipient batch.
+The live receipt reporter and fee-policy command were both run successfully
+against Base mainnet.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d49ff3bb1559f3ad4dc501e69e40b12b4b298640
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..0dd8e7e4d4cd750f53aea4d43e41213a85e7a9cd
--- a/package.json
+++ b/package.json
@@ -1,4 +1,9 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "scripts": {
+    "fees:base": "node scripts/base-fee-policy.mjs",
+    "costs:base": "node scripts/relayer-cost-report.mjs",
+    "test": "forge test"
+  }
 }
diff --git a/scripts/base-fee-policy.mjs b/scripts/base-fee-policy.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..aa802605fac580e50d13d3d50ba43238353bacbf
--- /dev/null
+++ b/scripts/base-fee-policy.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+
+// Gets current Base fee data at submission time. It intentionally does not use
+// a copied mainnet priority fee or a static gwei constant.
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const urgency = process.env.FEE_URGENCY ?? "standard";
+const percentile = { economical: 25, standard: 50, urgent: 90 }[urgency];
+if (percentile === undefined) throw new Error("FEE_URGENCY must be economical, standard, or urgent");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const [latest, history, suggestedGasPrice] = await Promise.all([
+  rpc("eth_getBlockByNumber", ["latest", false]),
+  rpc("eth_feeHistory", ["0x5", "latest", [percentile]]),
+  rpc("eth_gasPrice", []),
+]);
+const toBigInt = (hex) => BigInt(hex);
+const baseFee = toBigInt(latest.baseFeePerGas);
+const rewards = history.reward.map((row) => toBigInt(row[0]));
+const priorityFee = rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[Math.floor(rewards.length / 2)];
+// Two blocks of base-fee headroom avoids a replacement storm while retaining a
+// current-chain derived cap. Base may enforce a network minimum gas price, so
+// never set a cap below its current suggestion.
+const maxFeePerGas = [baseFee * 2n + priorityFee, toBigInt(suggestedGasPrice)].reduce((a, b) => a > b ? a : b);
+
+const asGwei = (value) => Number(value) / 1e9;
+console.log(JSON.stringify({
+  chainId: 8453,
+  sampledAt: new Date().toISOString(),
+  urgency,
+  baseFeePerGasWei: baseFee.toString(),
+  maxPriorityFeePerGasWei: priorityFee.toString(),
+  maxFeePerGasWei: maxFeePerGas.toString(),
+  suggestedGasPriceWei: suggestedGasPrice,
+  displayGwei: {
+    baseFee: asGwei(baseFee),
+    maxPriorityFee: asGwei(priorityFee),
+    maxFee: asGwei(maxFeePerGas),
+  },
+}, null, 2));
diff --git a/scripts/relayer-cost-report.mjs b/scripts/relayer-cost-report.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..09ece32cc1fa74432fe6bccad637bd31bbd6ff86
--- /dev/null
+++ b/scripts/relayer-cost-report.mjs
@@ -0,0 +1,63 @@
+#!/usr/bin/env node
+
+// Usage: node scripts/relayer-cost-report.mjs tx-hashes.txt
+// The input is one Base transaction hash per line. Export these from the
+// relayer database; public Base RPCs cannot efficiently query by sender.
+import { readFile } from "node:fs/promises";
+
+const hashesFile = process.argv[2];
+if (!hashesFile) throw new Error("Usage: node scripts/relayer-cost-report.mjs tx-hashes.txt");
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const hashes = (await readFile(hashesFile, "utf8"))
+  .split(/\s+/)
+  .filter(Boolean)
+  .filter((hash, index, all) => all.indexOf(hash) === index);
+if (hashes.length === 0) throw new Error("No transaction hashes found");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const priceResponse = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot");
+if (!priceResponse.ok) throw new Error("Could not fetch ETH/USD spot price");
+const ethUsd = Number((await priceResponse.json()).data.amount);
+const receipts = [];
+// Keep requests bounded so this can run against conservative public RPC limits.
+for (let i = 0; i < hashes.length; i += 20) {
+  const group = hashes.slice(i, i + 20);
+  receipts.push(...await Promise.all(group.map((hash) => rpc("eth_getTransactionReceipt", [hash]))));
+}
+
+let executionWei = 0n;
+let l1Wei = 0n;
+for (let i = 0; i < receipts.length; ++i) {
+  const receipt = receipts[i];
+  if (!receipt) throw new Error(`Receipt not found: ${hashes[i]}`);
+  executionWei += BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice);
+  // OP-stack receipts expose l1Fee. Treat its absence as zero, but surface it
+  // so a provider schema change cannot silently be mistaken for a saving.
+  l1Wei += receipt.l1Fee ? BigInt(receipt.l1Fee) : 0n;
+}
+const totalWei = executionWei + l1Wei;
+const weiToEth = (value) => Number(value) / 1e18;
+const usd = (value) => weiToEth(value) * ethUsd;
+console.log(JSON.stringify({
+  chainId: 8453,
+  transactions: receipts.length,
+  ethUsd,
+  executionWei: executionWei.toString(),
+  l1DataWei: l1Wei.toString(),
+  totalWei: totalWei.toString(),
+  executionUsd: usd(executionWei),
+  l1DataUsd: usd(l1Wei),
+  totalUsd: usd(totalWei),
+  averageUsdPerTransaction: usd(totalWei) / receipts.length,
+  receiptsWithoutL1Fee: receipts.filter((receipt) => !receipt.l1Fee).length,
+}, null, 2));
diff --git a/src/BatchPayer.sol b/src/BatchPayer.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f61adeab92414abbddee11967b9b01dc3e7bc94
--- /dev/null
+++ b/src/BatchPayer.sol
@@ -0,0 +1,72 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Holds payment tokens and distributes them in one transaction.
+/// @dev Fund this contract directly. Do not use `transferFrom` for every
+/// recipient: the allowance update and extra call remove much of the benefit.
+contract BatchPayer {
+    error Unauthorized();
+    error ReentrantCall();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error TokenTransferFailed(uint256 index);
+
+    uint256 public constant MAX_RECIPIENTS = 200;
+
+    address public immutable owner;
+    uint256 private locked = 1;
+
+    event BatchPaid(address indexed token, uint256 recipients, uint256 total);
+
+    constructor(address owner_) {
+        if (owner_ == address(0)) revert Unauthorized();
+        owner = owner_;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    /// @notice Pays every recipient from this contract's balance.
+    /// @dev Supports ERC-20s that either return true or return no value.
+    function pay(
+        address token,
+        address[] calldata recipients,
+        uint256[] calldata amounts
+    ) external onlyOwner nonReentrant {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_RECIPIENTS) revert BatchTooLarge();
+
+        uint256 total;
+        for (uint256 i; i < length; ++i) {
+            total += amounts[i];
+            _safeTransfer(token, recipients[i], amounts[i], i);
+        }
+        emit BatchPaid(token, length, total);
+    }
+
+    /// @notice Lets the owner recover a token after a failed or retired campaign.
+    function recover(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
+        _safeTransfer(token, recipient, amount, type(uint256).max);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount, uint256 index) private {
+        (bool ok, bytes memory result) = token.call(
+            abi.encodeWithSelector(0xa9059cbb, recipient, amount)
+        );
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
+            revert TokenTransferFailed(index);
+        }
+    }
+}
diff --git a/src/MockERC20.sol b/src/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb8a06b96f4fe162571487dcac3de39faff74b80
--- /dev/null
+++ b/src/MockERC20.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    constructor(address initialHolder, uint256 supply) {
+        balanceOf[initialHolder] = supply;
+    }
+
+    function transfer(address recipient, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[recipient] += amount;
+        return true;
+    }
+}
diff --git a/test/BatchPayer.t.sol b/test/BatchPayer.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a69fbb133ffa2fae928f964b5904de765df64db9
--- /dev/null
+++ b/test/BatchPayer.t.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {BatchPayer} from "../src/BatchPayer.sol";
+import {MockERC20} from "../src/MockERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+}
+
+contract BatchPayerTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant RECIPIENT_A = address(0xB0B);
+    address private constant RECIPIENT_B = address(0xCA01);
+    address private constant RECIPIENT_C = address(0xD0D);
+
+    BatchPayer private payer;
+    MockERC20 private token;
+
+    function setUp() public {
+        payer = new BatchPayer(OWNER);
+        token = new MockERC20(address(payer), 1_000_000);
+    }
+
+    function testPaysBatch() public {
+        address[] memory recipients = new address[](3);
+        recipients[0] = RECIPIENT_A;
+        recipients[1] = RECIPIENT_B;
+        recipients[2] = RECIPIENT_C;
+        uint256[] memory amounts = new uint256[](3);
+        amounts[0] = 11;
+        amounts[1] = 22;
+        amounts[2] = 33;
+
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+
+        require(token.balanceOf(RECIPIENT_A) == 11, "recipient A not paid");
+        require(token.balanceOf(RECIPIENT_B) == 22, "recipient B not paid");
+        require(token.balanceOf(RECIPIENT_C) == 33, "recipient C not paid");
+    }
+
+    function testRejectsNonOwner() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = RECIPIENT_A;
+        uint256[] memory amounts = new uint256[](1);
+        amounts[0] = 1;
+        (bool ok,) = address(payer).call(
+            abi.encodeCall(BatchPayer.pay, (address(token), recipients, amounts))
+        );
+        require(!ok, "non-owner paid");
+    }
+
+    // This is deliberately separate from the batch test so `forge test
+    // --gas-report` records the cost of the ordinary ERC-20 transfer too.
+    function testDirectTransfersBaseline() public {
+        MockERC20 directToken = new MockERC20(OWNER, 1_000_000);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_A, 11);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_B, 22);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_C, 33);
+    }
+
+    function testPaysHundredRecipients() public {
+        address[] memory recipients = new address[](100);
+        uint256[] memory amounts = new uint256[](100);
+        for (uint256 i; i < 100; ++i) {
+            recipients[i] = address(uint160(i + 0x1000));
+            amounts[i] = 1;
+        }
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+        require(token.balanceOf(recipients[99]) == 1, "last recipient not paid");
+    }
+}

diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..d73c73fc5861701cbf96dfefe2348421b0c82014
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,126 @@
+# Base relayer gas plan
+
+## Current run rate
+
+This is a live, reproducible point-in-time estimate, not a stale gas-price
+assumption. On 2026-08-28 00:02 UTC, a confirmed plain Base USDC transfer
+(`0x0e4ffb9e73f39bb860ead1616795a8dc480ec8e856209034ceb97b462f863c4b`)
+had these receipt fields:
+
+| Component | Measured amount | Cost at ETH = $2,509.38 |
+| --- | ---: | ---: |
+| L2 execution | 45,047 gas × 0.006 gwei = 270,282,000,000 wei | $0.00067824 |
+| L1 data fee | 462,707,932 wei | $0.00000116 |
+| **One payment** | **270,744,707,932 wei** | **$0.00067940** |
+| **40,000 payments/day** | — | **$27.18/day** |
+| **30-day month** | — | **$815.28/month** |
+| **365-day year** | — | **$9,919.26/year** |
+
+Formula: `gasUsed × effectiveGasPrice + l1Fee`; USD is the result in ETH
+multiplied by live ETH/USD. The L1 fee is only 0.17% of this sample, so Base
+execution gas—not data availability—is the meaningful lever today. Values move
+with the receipt and ETH/USD price.
+
+Run `npm run costs:base -- tx-hashes.txt` against a daily export of relayer
+transaction hashes. It calculates the actual total and explicitly includes the
+OP-stack `l1Fee`; use that report for Finance's ledger rather than extrapolating
+this one transaction forever.
+
+## Ranked actions
+
+### 1. Ship batched payouts in groups of 100 — estimated $397/month saved
+
+This is the largest known saving. Instead of 100 externally submitted ERC-20
+transactions, submit one transaction that calls the token 100 times from a
+funded payout contract.
+
+The included local benchmark, using new recipient balances (the expensive common
+case), measured 2,519,396 gas for `BatchPayer.pay` with 100 recipients. The
+same mock token's standalone `transfer` is 49,230 gas, or 4,923,000 gas for
+100 payments. That is a 48.82% execution-gas reduction:
+
+```
+daily execution spend     = 40,000 × 45,047 × 0.006 gwei × $2,509.38 = $27.13
+estimated daily saving    = $27.13 × 48.82% = $13.24
+estimated 30-day saving   = $397.34
+estimated annual saving   = $4,834
+```
+
+The estimate deliberately does **not** take a saving on L1 data fees. Before
+rollout, deploy on Base testnet, run the actual token and representative
+recipient mix through `eth_estimateGas`, and replace the 48.82% benchmark with
+the measured total including `l1Fee`. Use an initial 100-recipient batch; the
+contract permits at most 200 only as a safety ceiling, not a default.
+
+Operational trade-off: this requires prefunding the contract, rather than
+holding tokens in the relayer EOA. That changes custody and must get a security
+review, monitoring, and a staged rollout. It also assumes a conventional ERC-20
+that returns `true` or no return value; fee-on-transfer/rebasing tokens require
+token-specific payment reconciliation. The deploy itself is negligible at the
+observed price: 403,447 gas × 0.006 gwei × $2,509.38 = about $0.006.
+
+Implemented: `src/BatchPayer.sol`, with owner-only payments, token-transfer
+checks, a reentrancy guard, recovery, and a 200-recipient ceiling. Tests cover
+normal payments, access control, and the 100-recipient case.
+
+### 2. Derive EIP-1559 fees from Base immediately before submission — $0 now; $135/month per excess 0.001 gwei eliminated
+
+The live Base RPC at the measurement time reported a 0.005 gwei base fee and
+0.006 gwei suggested gas price. If the relayer already lands at that effective
+price, this change saves no money today; it prevents an accidental overbid.
+
+At this workload, every **0.001 gwei** of avoidable *effective* price costs:
+
+```
+40,000 × 45,047 × 0.001 gwei × $2,509.38 = $4.52/day = $135.64/30-day month
+```
+
+For example, reducing an actually-paid 0.020 gwei to 0.006 gwei would save
+about $1,899/month. Verify that from receipts first—`maxFeePerGas` is a cap,
+not necessarily what was paid.
+
+Implemented: `npm run fees:base` samples Base `eth_feeHistory`, current base
+fee, and `eth_gasPrice` at submission time and emits `maxFeePerGas` plus
+`maxPriorityFeePerGas`. Wire those returned wei values into the relayer's
+transaction request; do not hard-code a mainnet tip or copy a past Base value.
+Set `FEE_URGENCY` to `economical`, `standard` (default), or `urgent`.
+
+### 3. Do not add per-payment approvals or a `transferFrom` batcher — avoids up to $815/month of self-inflicted spend
+
+The relayer currently sends its own ERC-20 transfers. Keep that model or fund
+the batch contract once. A design that calls `approve` and then
+`transferFrom` for each payment adds another transaction-shaped operation per
+payment and largely defeats batching. If an approval were being sent once for
+every current payment, the order of magnitude is another current transfer run
+rate: about $27/day / $815 per 30-day month. This is a design guardrail, not a
+claimed existing saving; no approvals were provided to measure.
+
+### 4. Do not chase calldata micro-optimizations before measuring them — no material demonstrated saving
+
+A direct ERC-20 `transfer(address,uint256)` already has fixed, compact ABI
+calldata. The live receipt's L1 fee was $0.00000116, so even eliminating all of
+that impossible-to-eliminate fee would save only about $1.39/month at this
+volume. Recipient and amount data are required in a batch too. Measure actual
+batch receipts before changing encodings or token interfaces.
+
+## Shipping checklist
+
+1. Export one normal day of successful relayer transaction hashes and retain the
+   JSON output of `npm run costs:base -- tx-hashes.txt` as Finance's baseline.
+2. Integrate `npm run fees:base`'s wei values in the submission path and alert
+   on effective gas price above the chosen envelope.
+3. Deploy `BatchPayer` first on testnet with the exact production token; test
+   normal, duplicate, zero-amount, and failed-token behaviors, then measure
+   Base receipts for 1, 10, 50, and 100 recipients.
+4. Have the contract reviewed, place ownership in the production custody
+   arrangement, fund a small capped float, and canary a small percentage of
+   payments. Reconcile every `BatchPaid` event with recipient token balance
+   changes before increasing the batch share.
+5. Recompute this ranking weekly from receipts. Gas price and ETH/USD are
+   variable; the code intentionally reads both at run time.
+
+## Verification performed
+
+`forge test --gas-report` passes: 4 tests, including the 100-recipient batch.
+The live receipt reporter and fee-policy command were both run successfully
+against Base mainnet.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d49ff3bb1559f3ad4dc501e69e40b12b4b298640
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..0dd8e7e4d4cd750f53aea4d43e41213a85e7a9cd
--- a/package.json
+++ b/package.json
@@ -1,4 +1,9 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "scripts": {
+    "fees:base": "node scripts/base-fee-policy.mjs",
+    "costs:base": "node scripts/relayer-cost-report.mjs",
+    "test": "forge test"
+  }
 }
diff --git a/scripts/base-fee-policy.mjs b/scripts/base-fee-policy.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..aa802605fac580e50d13d3d50ba43238353bacbf
--- /dev/null
+++ b/scripts/base-fee-policy.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+
+// Gets current Base fee data at submission time. It intentionally does not use
+// a copied mainnet priority fee or a static gwei constant.
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const urgency = process.env.FEE_URGENCY ?? "standard";
+const percentile = { economical: 25, standard: 50, urgent: 90 }[urgency];
+if (percentile === undefined) throw new Error("FEE_URGENCY must be economical, standard, or urgent");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const [latest, history, suggestedGasPrice] = await Promise.all([
+  rpc("eth_getBlockByNumber", ["latest", false]),
+  rpc("eth_feeHistory", ["0x5", "latest", [percentile]]),
+  rpc("eth_gasPrice", []),
+]);
+const toBigInt = (hex) => BigInt(hex);
+const baseFee = toBigInt(latest.baseFeePerGas);
+const rewards = history.reward.map((row) => toBigInt(row[0]));
+const priorityFee = rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[Math.floor(rewards.length / 2)];
+// Two blocks of base-fee headroom avoids a replacement storm while retaining a
+// current-chain derived cap. Base may enforce a network minimum gas price, so
+// never set a cap below its current suggestion.
+const maxFeePerGas = [baseFee * 2n + priorityFee, toBigInt(suggestedGasPrice)].reduce((a, b) => a > b ? a : b);
+
+const asGwei = (value) => Number(value) / 1e9;
+console.log(JSON.stringify({
+  chainId: 8453,
+  sampledAt: new Date().toISOString(),
+  urgency,
+  baseFeePerGasWei: baseFee.toString(),
+  maxPriorityFeePerGasWei: priorityFee.toString(),
+  maxFeePerGasWei: maxFeePerGas.toString(),
+  suggestedGasPriceWei: suggestedGasPrice,
+  displayGwei: {
+    baseFee: asGwei(baseFee),
+    maxPriorityFee: asGwei(priorityFee),
+    maxFee: asGwei(maxFeePerGas),
+  },
+}, null, 2));
diff --git a/scripts/relayer-cost-report.mjs b/scripts/relayer-cost-report.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..09ece32cc1fa74432fe6bccad637bd31bbd6ff86
--- /dev/null
+++ b/scripts/relayer-cost-report.mjs
@@ -0,0 +1,63 @@
+#!/usr/bin/env node
+
+// Usage: node scripts/relayer-cost-report.mjs tx-hashes.txt
+// The input is one Base transaction hash per line. Export these from the
+// relayer database; public Base RPCs cannot efficiently query by sender.
+import { readFile } from "node:fs/promises";
+
+const hashesFile = process.argv[2];
+if (!hashesFile) throw new Error("Usage: node scripts/relayer-cost-report.mjs tx-hashes.txt");
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const hashes = (await readFile(hashesFile, "utf8"))
+  .split(/\s+/)
+  .filter(Boolean)
+  .filter((hash, index, all) => all.indexOf(hash) === index);
+if (hashes.length === 0) throw new Error("No transaction hashes found");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const priceResponse = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot");
+if (!priceResponse.ok) throw new Error("Could not fetch ETH/USD spot price");
+const ethUsd = Number((await priceResponse.json()).data.amount);
+const receipts = [];
+// Keep requests bounded so this can run against conservative public RPC limits.
+for (let i = 0; i < hashes.length; i += 20) {
+  const group = hashes.slice(i, i + 20);
+  receipts.push(...await Promise.all(group.map((hash) => rpc("eth_getTransactionReceipt", [hash]))));
+}
+
+let executionWei = 0n;
+let l1Wei = 0n;
+for (let i = 0; i < receipts.length; ++i) {
+  const receipt = receipts[i];
+  if (!receipt) throw new Error(`Receipt not found: ${hashes[i]}`);
+  executionWei += BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice);
+  // OP-stack receipts expose l1Fee. Treat its absence as zero, but surface it
+  // so a provider schema change cannot silently be mistaken for a saving.
+  l1Wei += receipt.l1Fee ? BigInt(receipt.l1Fee) : 0n;
+}
+const totalWei = executionWei + l1Wei;
+const weiToEth = (value) => Number(value) / 1e18;
+const usd = (value) => weiToEth(value) * ethUsd;
+console.log(JSON.stringify({
+  chainId: 8453,
+  transactions: receipts.length,
+  ethUsd,
+  executionWei: executionWei.toString(),
+  l1DataWei: l1Wei.toString(),
+  totalWei: totalWei.toString(),
+  executionUsd: usd(executionWei),
+  l1DataUsd: usd(l1Wei),
+  totalUsd: usd(totalWei),
+  averageUsdPerTransaction: usd(totalWei) / receipts.length,
+  receiptsWithoutL1Fee: receipts.filter((receipt) => !receipt.l1Fee).length,
+}, null, 2));
diff --git a/src/BatchPayer.sol b/src/BatchPayer.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f61adeab92414abbddee11967b9b01dc3e7bc94
--- /dev/null
+++ b/src/BatchPayer.sol
@@ -0,0 +1,72 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Holds payment tokens and distributes them in one transaction.
+/// @dev Fund this contract directly. Do not use `transferFrom` for every
+/// recipient: the allowance update and extra call remove much of the benefit.
+contract BatchPayer {
+    error Unauthorized();
+    error ReentrantCall();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error TokenTransferFailed(uint256 index);
+
+    uint256 public constant MAX_RECIPIENTS = 200;
+
+    address public immutable owner;
+    uint256 private locked = 1;
+
+    event BatchPaid(address indexed token, uint256 recipients, uint256 total);
+
+    constructor(address owner_) {
+        if (owner_ == address(0)) revert Unauthorized();
+        owner = owner_;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    /// @notice Pays every recipient from this contract's balance.
+    /// @dev Supports ERC-20s that either return true or return no value.
+    function pay(
+        address token,
+        address[] calldata recipients,
+        uint256[] calldata amounts
+    ) external onlyOwner nonReentrant {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_RECIPIENTS) revert BatchTooLarge();
+
+        uint256 total;
+        for (uint256 i; i < length; ++i) {
+            total += amounts[i];
+            _safeTransfer(token, recipients[i], amounts[i], i);
+        }
+        emit BatchPaid(token, length, total);
+    }
+
+    /// @notice Lets the owner recover a token after a failed or retired campaign.
+    function recover(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
+        _safeTransfer(token, recipient, amount, type(uint256).max);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount, uint256 index) private {
+        (bool ok, bytes memory result) = token.call(
+            abi.encodeWithSelector(0xa9059cbb, recipient, amount)
+        );
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
+            revert TokenTransferFailed(index);
+        }
+    }
+}
diff --git a/src/MockERC20.sol b/src/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb8a06b96f4fe162571487dcac3de39faff74b80
--- /dev/null
+++ b/src/MockERC20.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    constructor(address initialHolder, uint256 supply) {
+        balanceOf[initialHolder] = supply;
+    }
+
+    function transfer(address recipient, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[recipient] += amount;
+        return true;
+    }
+}
diff --git a/test/BatchPayer.t.sol b/test/BatchPayer.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a69fbb133ffa2fae928f964b5904de765df64db9
--- /dev/null
+++ b/test/BatchPayer.t.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {BatchPayer} from "../src/BatchPayer.sol";
+import {MockERC20} from "../src/MockERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+}
+
+contract BatchPayerTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant RECIPIENT_A = address(0xB0B);
+    address private constant RECIPIENT_B = address(0xCA01);
+    address private constant RECIPIENT_C = address(0xD0D);
+
+    BatchPayer private payer;
+    MockERC20 private token;
+
+    function setUp() public {
+        payer = new BatchPayer(OWNER);
+        token = new MockERC20(address(payer), 1_000_000);
+    }
+
+    function testPaysBatch() public {
+        address[] memory recipients = new address[](3);
+        recipients[0] = RECIPIENT_A;
+        recipients[1] = RECIPIENT_B;
+        recipients[2] = RECIPIENT_C;
+        uint256[] memory amounts = new uint256[](3);
+        amounts[0] = 11;
+        amounts[1] = 22;
+        amounts[2] = 33;
+
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+
+        require(token.balanceOf(RECIPIENT_A) == 11, "recipient A not paid");
+        require(token.balanceOf(RECIPIENT_B) == 22, "recipient B not paid");
+        require(token.balanceOf(RECIPIENT_C) == 33, "recipient C not paid");
+    }
+
+    function testRejectsNonOwner() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = RECIPIENT_A;
+        uint256[] memory amounts = new uint256[](1);
+        amounts[0] = 1;
+        (bool ok,) = address(payer).call(
+            abi.encodeCall(BatchPayer.pay, (address(token), recipients, amounts))
+        );
+        require(!ok, "non-owner paid");
+    }
+
+    // This is deliberately separate from the batch test so `forge test
+    // --gas-report` records the cost of the ordinary ERC-20 transfer too.
+    function testDirectTransfersBaseline() public {
+        MockERC20 directToken = new MockERC20(OWNER, 1_000_000);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_A, 11);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_B, 22);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_C, 33);
+    }
+
+    function testPaysHundredRecipients() public {
+        address[] memory recipients = new address[](100);
+        uint256[] memory amounts = new uint256[](100);
+        for (uint256 i; i < 100; ++i) {
+            recipients[i] = address(uint160(i + 0x1000));
+            amounts[i] = 1;
+        }
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+        require(token.balanceOf(recipients[99]) == 1, "last recipient not paid");
+    }
+}

exec
/bin/bash -lc 'git diff --check && git diff --stat && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
 package.json | 7 ++++++-
 1 file changed, 6 insertions(+), 1 deletion(-)
 M package.json
?? PLAN.md
?? foundry.toml
?? scripts/
?? src/
?? test/

diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..d73c73fc5861701cbf96dfefe2348421b0c82014
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,126 @@
+# Base relayer gas plan
+
+## Current run rate
+
+This is a live, reproducible point-in-time estimate, not a stale gas-price
+assumption. On 2026-08-28 00:02 UTC, a confirmed plain Base USDC transfer
+(`0x0e4ffb9e73f39bb860ead1616795a8dc480ec8e856209034ceb97b462f863c4b`)
+had these receipt fields:
+
+| Component | Measured amount | Cost at ETH = $2,509.38 |
+| --- | ---: | ---: |
+| L2 execution | 45,047 gas × 0.006 gwei = 270,282,000,000 wei | $0.00067824 |
+| L1 data fee | 462,707,932 wei | $0.00000116 |
+| **One payment** | **270,744,707,932 wei** | **$0.00067940** |
+| **40,000 payments/day** | — | **$27.18/day** |
+| **30-day month** | — | **$815.28/month** |
+| **365-day year** | — | **$9,919.26/year** |
+
+Formula: `gasUsed × effectiveGasPrice + l1Fee`; USD is the result in ETH
+multiplied by live ETH/USD. The L1 fee is only 0.17% of this sample, so Base
+execution gas—not data availability—is the meaningful lever today. Values move
+with the receipt and ETH/USD price.
+
+Run `npm run costs:base -- tx-hashes.txt` against a daily export of relayer
+transaction hashes. It calculates the actual total and explicitly includes the
+OP-stack `l1Fee`; use that report for Finance's ledger rather than extrapolating
+this one transaction forever.
+
+## Ranked actions
+
+### 1. Ship batched payouts in groups of 100 — estimated $397/month saved
+
+This is the largest known saving. Instead of 100 externally submitted ERC-20
+transactions, submit one transaction that calls the token 100 times from a
+funded payout contract.
+
+The included local benchmark, using new recipient balances (the expensive common
+case), measured 2,519,396 gas for `BatchPayer.pay` with 100 recipients. The
+same mock token's standalone `transfer` is 49,230 gas, or 4,923,000 gas for
+100 payments. That is a 48.82% execution-gas reduction:
+
+```
+daily execution spend     = 40,000 × 45,047 × 0.006 gwei × $2,509.38 = $27.13
+estimated daily saving    = $27.13 × 48.82% = $13.24
+estimated 30-day saving   = $397.34
+estimated annual saving   = $4,834
+```
+
+The estimate deliberately does **not** take a saving on L1 data fees. Before
+rollout, deploy on Base testnet, run the actual token and representative
+recipient mix through `eth_estimateGas`, and replace the 48.82% benchmark with
+the measured total including `l1Fee`. Use an initial 100-recipient batch; the
+contract permits at most 200 only as a safety ceiling, not a default.
+
+Operational trade-off: this requires prefunding the contract, rather than
+holding tokens in the relayer EOA. That changes custody and must get a security
+review, monitoring, and a staged rollout. It also assumes a conventional ERC-20
+that returns `true` or no return value; fee-on-transfer/rebasing tokens require
+token-specific payment reconciliation. The deploy itself is negligible at the
+observed price: 403,447 gas × 0.006 gwei × $2,509.38 = about $0.006.
+
+Implemented: `src/BatchPayer.sol`, with owner-only payments, token-transfer
+checks, a reentrancy guard, recovery, and a 200-recipient ceiling. Tests cover
+normal payments, access control, and the 100-recipient case.
+
+### 2. Derive EIP-1559 fees from Base immediately before submission — $0 now; $135/month per excess 0.001 gwei eliminated
+
+The live Base RPC at the measurement time reported a 0.005 gwei base fee and
+0.006 gwei suggested gas price. If the relayer already lands at that effective
+price, this change saves no money today; it prevents an accidental overbid.
+
+At this workload, every **0.001 gwei** of avoidable *effective* price costs:
+
+```
+40,000 × 45,047 × 0.001 gwei × $2,509.38 = $4.52/day = $135.64/30-day month
+```
+
+For example, reducing an actually-paid 0.020 gwei to 0.006 gwei would save
+about $1,899/month. Verify that from receipts first—`maxFeePerGas` is a cap,
+not necessarily what was paid.
+
+Implemented: `npm run fees:base` samples Base `eth_feeHistory`, current base
+fee, and `eth_gasPrice` at submission time and emits `maxFeePerGas` plus
+`maxPriorityFeePerGas`. Wire those returned wei values into the relayer's
+transaction request; do not hard-code a mainnet tip or copy a past Base value.
+Set `FEE_URGENCY` to `economical`, `standard` (default), or `urgent`.
+
+### 3. Do not add per-payment approvals or a `transferFrom` batcher — avoids up to $815/month of self-inflicted spend
+
+The relayer currently sends its own ERC-20 transfers. Keep that model or fund
+the batch contract once. A design that calls `approve` and then
+`transferFrom` for each payment adds another transaction-shaped operation per
+payment and largely defeats batching. If an approval were being sent once for
+every current payment, the order of magnitude is another current transfer run
+rate: about $27/day / $815 per 30-day month. This is a design guardrail, not a
+claimed existing saving; no approvals were provided to measure.
+
+### 4. Do not chase calldata micro-optimizations before measuring them — no material demonstrated saving
+
+A direct ERC-20 `transfer(address,uint256)` already has fixed, compact ABI
+calldata. The live receipt's L1 fee was $0.00000116, so even eliminating all of
+that impossible-to-eliminate fee would save only about $1.39/month at this
+volume. Recipient and amount data are required in a batch too. Measure actual
+batch receipts before changing encodings or token interfaces.
+
+## Shipping checklist
+
+1. Export one normal day of successful relayer transaction hashes and retain the
+   JSON output of `npm run costs:base -- tx-hashes.txt` as Finance's baseline.
+2. Integrate `npm run fees:base`'s wei values in the submission path and alert
+   on effective gas price above the chosen envelope.
+3. Deploy `BatchPayer` first on testnet with the exact production token; test
+   normal, duplicate, zero-amount, and failed-token behaviors, then measure
+   Base receipts for 1, 10, 50, and 100 recipients.
+4. Have the contract reviewed, place ownership in the production custody
+   arrangement, fund a small capped float, and canary a small percentage of
+   payments. Reconcile every `BatchPaid` event with recipient token balance
+   changes before increasing the batch share.
+5. Recompute this ranking weekly from receipts. Gas price and ETH/USD are
+   variable; the code intentionally reads both at run time.
+
+## Verification performed
+
+`forge test --gas-report` passes: 4 tests, including the 100-recipient batch.
+The live receipt reporter and fee-policy command were both run successfully
+against Base mainnet.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d49ff3bb1559f3ad4dc501e69e40b12b4b298640
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..0dd8e7e4d4cd750f53aea4d43e41213a85e7a9cd
--- a/package.json
+++ b/package.json
@@ -1,4 +1,9 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "scripts": {
+    "fees:base": "node scripts/base-fee-policy.mjs",
+    "costs:base": "node scripts/relayer-cost-report.mjs",
+    "test": "forge test"
+  }
 }
diff --git a/scripts/base-fee-policy.mjs b/scripts/base-fee-policy.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..aa802605fac580e50d13d3d50ba43238353bacbf
--- /dev/null
+++ b/scripts/base-fee-policy.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+
+// Gets current Base fee data at submission time. It intentionally does not use
+// a copied mainnet priority fee or a static gwei constant.
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const urgency = process.env.FEE_URGENCY ?? "standard";
+const percentile = { economical: 25, standard: 50, urgent: 90 }[urgency];
+if (percentile === undefined) throw new Error("FEE_URGENCY must be economical, standard, or urgent");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const [latest, history, suggestedGasPrice] = await Promise.all([
+  rpc("eth_getBlockByNumber", ["latest", false]),
+  rpc("eth_feeHistory", ["0x5", "latest", [percentile]]),
+  rpc("eth_gasPrice", []),
+]);
+const toBigInt = (hex) => BigInt(hex);
+const baseFee = toBigInt(latest.baseFeePerGas);
+const rewards = history.reward.map((row) => toBigInt(row[0]));
+const priorityFee = rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[Math.floor(rewards.length / 2)];
+// Two blocks of base-fee headroom avoids a replacement storm while retaining a
+// current-chain derived cap. Base may enforce a network minimum gas price, so
+// never set a cap below its current suggestion.
+const maxFeePerGas = [baseFee * 2n + priorityFee, toBigInt(suggestedGasPrice)].reduce((a, b) => a > b ? a : b);
+
+const asGwei = (value) => Number(value) / 1e9;
+console.log(JSON.stringify({
+  chainId: 8453,
+  sampledAt: new Date().toISOString(),
+  urgency,
+  baseFeePerGasWei: baseFee.toString(),
+  maxPriorityFeePerGasWei: priorityFee.toString(),
+  maxFeePerGasWei: maxFeePerGas.toString(),
+  suggestedGasPriceWei: suggestedGasPrice,
+  displayGwei: {
+    baseFee: asGwei(baseFee),
+    maxPriorityFee: asGwei(priorityFee),
+    maxFee: asGwei(maxFeePerGas),
+  },
+}, null, 2));
diff --git a/scripts/relayer-cost-report.mjs b/scripts/relayer-cost-report.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..09ece32cc1fa74432fe6bccad637bd31bbd6ff86
--- /dev/null
+++ b/scripts/relayer-cost-report.mjs
@@ -0,0 +1,63 @@
+#!/usr/bin/env node
+
+// Usage: node scripts/relayer-cost-report.mjs tx-hashes.txt
+// The input is one Base transaction hash per line. Export these from the
+// relayer database; public Base RPCs cannot efficiently query by sender.
+import { readFile } from "node:fs/promises";
+
+const hashesFile = process.argv[2];
+if (!hashesFile) throw new Error("Usage: node scripts/relayer-cost-report.mjs tx-hashes.txt");
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const hashes = (await readFile(hashesFile, "utf8"))
+  .split(/\s+/)
+  .filter(Boolean)
+  .filter((hash, index, all) => all.indexOf(hash) === index);
+if (hashes.length === 0) throw new Error("No transaction hashes found");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const priceResponse = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot");
+if (!priceResponse.ok) throw new Error("Could not fetch ETH/USD spot price");
+const ethUsd = Number((await priceResponse.json()).data.amount);
+const receipts = [];
+// Keep requests bounded so this can run against conservative public RPC limits.
+for (let i = 0; i < hashes.length; i += 20) {
+  const group = hashes.slice(i, i + 20);
+  receipts.push(...await Promise.all(group.map((hash) => rpc("eth_getTransactionReceipt", [hash]))));
+}
+
+let executionWei = 0n;
+let l1Wei = 0n;
+for (let i = 0; i < receipts.length; ++i) {
+  const receipt = receipts[i];
+  if (!receipt) throw new Error(`Receipt not found: ${hashes[i]}`);
+  executionWei += BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice);
+  // OP-stack receipts expose l1Fee. Treat its absence as zero, but surface it
+  // so a provider schema change cannot silently be mistaken for a saving.
+  l1Wei += receipt.l1Fee ? BigInt(receipt.l1Fee) : 0n;
+}
+const totalWei = executionWei + l1Wei;
+const weiToEth = (value) => Number(value) / 1e18;
+const usd = (value) => weiToEth(value) * ethUsd;
+console.log(JSON.stringify({
+  chainId: 8453,
+  transactions: receipts.length,
+  ethUsd,
+  executionWei: executionWei.toString(),
+  l1DataWei: l1Wei.toString(),
+  totalWei: totalWei.toString(),
+  executionUsd: usd(executionWei),
+  l1DataUsd: usd(l1Wei),
+  totalUsd: usd(totalWei),
+  averageUsdPerTransaction: usd(totalWei) / receipts.length,
+  receiptsWithoutL1Fee: receipts.filter((receipt) => !receipt.l1Fee).length,
+}, null, 2));
diff --git a/src/BatchPayer.sol b/src/BatchPayer.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f61adeab92414abbddee11967b9b01dc3e7bc94
--- /dev/null
+++ b/src/BatchPayer.sol
@@ -0,0 +1,72 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Holds payment tokens and distributes them in one transaction.
+/// @dev Fund this contract directly. Do not use `transferFrom` for every
+/// recipient: the allowance update and extra call remove much of the benefit.
+contract BatchPayer {
+    error Unauthorized();
+    error ReentrantCall();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error TokenTransferFailed(uint256 index);
+
+    uint256 public constant MAX_RECIPIENTS = 200;
+
+    address public immutable owner;
+    uint256 private locked = 1;
+
+    event BatchPaid(address indexed token, uint256 recipients, uint256 total);
+
+    constructor(address owner_) {
+        if (owner_ == address(0)) revert Unauthorized();
+        owner = owner_;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    /// @notice Pays every recipient from this contract's balance.
+    /// @dev Supports ERC-20s that either return true or return no value.
+    function pay(
+        address token,
+        address[] calldata recipients,
+        uint256[] calldata amounts
+    ) external onlyOwner nonReentrant {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_RECIPIENTS) revert BatchTooLarge();
+
+        uint256 total;
+        for (uint256 i; i < length; ++i) {
+            total += amounts[i];
+            _safeTransfer(token, recipients[i], amounts[i], i);
+        }
+        emit BatchPaid(token, length, total);
+    }
+
+    /// @notice Lets the owner recover a token after a failed or retired campaign.
+    function recover(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
+        _safeTransfer(token, recipient, amount, type(uint256).max);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount, uint256 index) private {
+        (bool ok, bytes memory result) = token.call(
+            abi.encodeWithSelector(0xa9059cbb, recipient, amount)
+        );
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
+            revert TokenTransferFailed(index);
+        }
+    }
+}
diff --git a/src/MockERC20.sol b/src/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb8a06b96f4fe162571487dcac3de39faff74b80
--- /dev/null
+++ b/src/MockERC20.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    constructor(address initialHolder, uint256 supply) {
+        balanceOf[initialHolder] = supply;
+    }
+
+    function transfer(address recipient, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[recipient] += amount;
+        return true;
+    }
+}
diff --git a/test/BatchPayer.t.sol b/test/BatchPayer.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a69fbb133ffa2fae928f964b5904de765df64db9
--- /dev/null
+++ b/test/BatchPayer.t.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {BatchPayer} from "../src/BatchPayer.sol";
+import {MockERC20} from "../src/MockERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+}
+
+contract BatchPayerTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant RECIPIENT_A = address(0xB0B);
+    address private constant RECIPIENT_B = address(0xCA01);
+    address private constant RECIPIENT_C = address(0xD0D);
+
+    BatchPayer private payer;
+    MockERC20 private token;
+
+    function setUp() public {
+        payer = new BatchPayer(OWNER);
+        token = new MockERC20(address(payer), 1_000_000);
+    }
+
+    function testPaysBatch() public {
+        address[] memory recipients = new address[](3);
+        recipients[0] = RECIPIENT_A;
+        recipients[1] = RECIPIENT_B;
+        recipients[2] = RECIPIENT_C;
+        uint256[] memory amounts = new uint256[](3);
+        amounts[0] = 11;
+        amounts[1] = 22;
+        amounts[2] = 33;
+
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+
+        require(token.balanceOf(RECIPIENT_A) == 11, "recipient A not paid");
+        require(token.balanceOf(RECIPIENT_B) == 22, "recipient B not paid");
+        require(token.balanceOf(RECIPIENT_C) == 33, "recipient C not paid");
+    }
+
+    function testRejectsNonOwner() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = RECIPIENT_A;
+        uint256[] memory amounts = new uint256[](1);
+        amounts[0] = 1;
+        (bool ok,) = address(payer).call(
+            abi.encodeCall(BatchPayer.pay, (address(token), recipients, amounts))
+        );
+        require(!ok, "non-owner paid");
+    }
+
+    // This is deliberately separate from the batch test so `forge test
+    // --gas-report` records the cost of the ordinary ERC-20 transfer too.
+    function testDirectTransfersBaseline() public {
+        MockERC20 directToken = new MockERC20(OWNER, 1_000_000);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_A, 11);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_B, 22);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_C, 33);
+    }
+
+    function testPaysHundredRecipients() public {
+        address[] memory recipients = new address[](100);
+        uint256[] memory amounts = new uint256[](100);
+        for (uint256 i; i < 100; ++i) {
+            recipients[i] = address(uint160(i + 0x1000));
+            amounts[i] = 1;
+        }
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+        require(token.balanceOf(recipients[99]) == 1, "last recipient not paid");
+    }
+}

codex
Completed the cost plan and shipping code.

- Current measured run rate: about **$27.18/day**, **$815/month** at 40k transfers/day.
- Best known saving: 100-recipient batches, estimated **$397/month** reduction (validate with the real token before rollout).
- Added a Base receipt cost reporter and live EIP-1559 fee-policy helper.
- Added a tested `BatchPayer` contract with access control, reentrancy protection, recovery, and batching limits.

Key files:

- [PLAN.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002/PLAN.md)
- [BatchPayer.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002/src/BatchPayer.sol)
- [relayer-cost-report.mjs](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002/scripts/relayer-cost-report.mjs)
- [base-fee-policy.mjs](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002/scripts/base-fee-policy.mjs)

Verification passed: `forge test --gas-report` (4 tests).
diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..d73c73fc5861701cbf96dfefe2348421b0c82014
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,126 @@
+# Base relayer gas plan
+
+## Current run rate
+
+This is a live, reproducible point-in-time estimate, not a stale gas-price
+assumption. On 2026-08-28 00:02 UTC, a confirmed plain Base USDC transfer
+(`0x0e4ffb9e73f39bb860ead1616795a8dc480ec8e856209034ceb97b462f863c4b`)
+had these receipt fields:
+
+| Component | Measured amount | Cost at ETH = $2,509.38 |
+| --- | ---: | ---: |
+| L2 execution | 45,047 gas × 0.006 gwei = 270,282,000,000 wei | $0.00067824 |
+| L1 data fee | 462,707,932 wei | $0.00000116 |
+| **One payment** | **270,744,707,932 wei** | **$0.00067940** |
+| **40,000 payments/day** | — | **$27.18/day** |
+| **30-day month** | — | **$815.28/month** |
+| **365-day year** | — | **$9,919.26/year** |
+
+Formula: `gasUsed × effectiveGasPrice + l1Fee`; USD is the result in ETH
+multiplied by live ETH/USD. The L1 fee is only 0.17% of this sample, so Base
+execution gas—not data availability—is the meaningful lever today. Values move
+with the receipt and ETH/USD price.
+
+Run `npm run costs:base -- tx-hashes.txt` against a daily export of relayer
+transaction hashes. It calculates the actual total and explicitly includes the
+OP-stack `l1Fee`; use that report for Finance's ledger rather than extrapolating
+this one transaction forever.
+
+## Ranked actions
+
+### 1. Ship batched payouts in groups of 100 — estimated $397/month saved
+
+This is the largest known saving. Instead of 100 externally submitted ERC-20
+transactions, submit one transaction that calls the token 100 times from a
+funded payout contract.
+
+The included local benchmark, using new recipient balances (the expensive common
+case), measured 2,519,396 gas for `BatchPayer.pay` with 100 recipients. The
+same mock token's standalone `transfer` is 49,230 gas, or 4,923,000 gas for
+100 payments. That is a 48.82% execution-gas reduction:
+
+```
+daily execution spend     = 40,000 × 45,047 × 0.006 gwei × $2,509.38 = $27.13
+estimated daily saving    = $27.13 × 48.82% = $13.24
+estimated 30-day saving   = $397.34
+estimated annual saving   = $4,834
+```
+
+The estimate deliberately does **not** take a saving on L1 data fees. Before
+rollout, deploy on Base testnet, run the actual token and representative
+recipient mix through `eth_estimateGas`, and replace the 48.82% benchmark with
+the measured total including `l1Fee`. Use an initial 100-recipient batch; the
+contract permits at most 200 only as a safety ceiling, not a default.
+
+Operational trade-off: this requires prefunding the contract, rather than
+holding tokens in the relayer EOA. That changes custody and must get a security
+review, monitoring, and a staged rollout. It also assumes a conventional ERC-20
+that returns `true` or no return value; fee-on-transfer/rebasing tokens require
+token-specific payment reconciliation. The deploy itself is negligible at the
+observed price: 403,447 gas × 0.006 gwei × $2,509.38 = about $0.006.
+
+Implemented: `src/BatchPayer.sol`, with owner-only payments, token-transfer
+checks, a reentrancy guard, recovery, and a 200-recipient ceiling. Tests cover
+normal payments, access control, and the 100-recipient case.
+
+### 2. Derive EIP-1559 fees from Base immediately before submission — $0 now; $135/month per excess 0.001 gwei eliminated
+
+The live Base RPC at the measurement time reported a 0.005 gwei base fee and
+0.006 gwei suggested gas price. If the relayer already lands at that effective
+price, this change saves no money today; it prevents an accidental overbid.
+
+At this workload, every **0.001 gwei** of avoidable *effective* price costs:
+
+```
+40,000 × 45,047 × 0.001 gwei × $2,509.38 = $4.52/day = $135.64/30-day month
+```
+
+For example, reducing an actually-paid 0.020 gwei to 0.006 gwei would save
+about $1,899/month. Verify that from receipts first—`maxFeePerGas` is a cap,
+not necessarily what was paid.
+
+Implemented: `npm run fees:base` samples Base `eth_feeHistory`, current base
+fee, and `eth_gasPrice` at submission time and emits `maxFeePerGas` plus
+`maxPriorityFeePerGas`. Wire those returned wei values into the relayer's
+transaction request; do not hard-code a mainnet tip or copy a past Base value.
+Set `FEE_URGENCY` to `economical`, `standard` (default), or `urgent`.
+
+### 3. Do not add per-payment approvals or a `transferFrom` batcher — avoids up to $815/month of self-inflicted spend
+
+The relayer currently sends its own ERC-20 transfers. Keep that model or fund
+the batch contract once. A design that calls `approve` and then
+`transferFrom` for each payment adds another transaction-shaped operation per
+payment and largely defeats batching. If an approval were being sent once for
+every current payment, the order of magnitude is another current transfer run
+rate: about $27/day / $815 per 30-day month. This is a design guardrail, not a
+claimed existing saving; no approvals were provided to measure.
+
+### 4. Do not chase calldata micro-optimizations before measuring them — no material demonstrated saving
+
+A direct ERC-20 `transfer(address,uint256)` already has fixed, compact ABI
+calldata. The live receipt's L1 fee was $0.00000116, so even eliminating all of
+that impossible-to-eliminate fee would save only about $1.39/month at this
+volume. Recipient and amount data are required in a batch too. Measure actual
+batch receipts before changing encodings or token interfaces.
+
+## Shipping checklist
+
+1. Export one normal day of successful relayer transaction hashes and retain the
+   JSON output of `npm run costs:base -- tx-hashes.txt` as Finance's baseline.
+2. Integrate `npm run fees:base`'s wei values in the submission path and alert
+   on effective gas price above the chosen envelope.
+3. Deploy `BatchPayer` first on testnet with the exact production token; test
+   normal, duplicate, zero-amount, and failed-token behaviors, then measure
+   Base receipts for 1, 10, 50, and 100 recipients.
+4. Have the contract reviewed, place ownership in the production custody
+   arrangement, fund a small capped float, and canary a small percentage of
+   payments. Reconcile every `BatchPaid` event with recipient token balance
+   changes before increasing the batch share.
+5. Recompute this ranking weekly from receipts. Gas price and ETH/USD are
+   variable; the code intentionally reads both at run time.
+
+## Verification performed
+
+`forge test --gas-report` passes: 4 tests, including the 100-recipient batch.
+The live receipt reporter and fee-policy command were both run successfully
+against Base mainnet.
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..d49ff3bb1559f3ad4dc501e69e40b12b4b298640
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.24"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..0dd8e7e4d4cd750f53aea4d43e41213a85e7a9cd
--- a/package.json
+++ b/package.json
@@ -1,4 +1,9 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "scripts": {
+    "fees:base": "node scripts/base-fee-policy.mjs",
+    "costs:base": "node scripts/relayer-cost-report.mjs",
+    "test": "forge test"
+  }
 }
diff --git a/scripts/base-fee-policy.mjs b/scripts/base-fee-policy.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..aa802605fac580e50d13d3d50ba43238353bacbf
--- /dev/null
+++ b/scripts/base-fee-policy.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+
+// Gets current Base fee data at submission time. It intentionally does not use
+// a copied mainnet priority fee or a static gwei constant.
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const urgency = process.env.FEE_URGENCY ?? "standard";
+const percentile = { economical: 25, standard: 50, urgent: 90 }[urgency];
+if (percentile === undefined) throw new Error("FEE_URGENCY must be economical, standard, or urgent");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const [latest, history, suggestedGasPrice] = await Promise.all([
+  rpc("eth_getBlockByNumber", ["latest", false]),
+  rpc("eth_feeHistory", ["0x5", "latest", [percentile]]),
+  rpc("eth_gasPrice", []),
+]);
+const toBigInt = (hex) => BigInt(hex);
+const baseFee = toBigInt(latest.baseFeePerGas);
+const rewards = history.reward.map((row) => toBigInt(row[0]));
+const priorityFee = rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[Math.floor(rewards.length / 2)];
+// Two blocks of base-fee headroom avoids a replacement storm while retaining a
+// current-chain derived cap. Base may enforce a network minimum gas price, so
+// never set a cap below its current suggestion.
+const maxFeePerGas = [baseFee * 2n + priorityFee, toBigInt(suggestedGasPrice)].reduce((a, b) => a > b ? a : b);
+
+const asGwei = (value) => Number(value) / 1e9;
+console.log(JSON.stringify({
+  chainId: 8453,
+  sampledAt: new Date().toISOString(),
+  urgency,
+  baseFeePerGasWei: baseFee.toString(),
+  maxPriorityFeePerGasWei: priorityFee.toString(),
+  maxFeePerGasWei: maxFeePerGas.toString(),
+  suggestedGasPriceWei: suggestedGasPrice,
+  displayGwei: {
+    baseFee: asGwei(baseFee),
+    maxPriorityFee: asGwei(priorityFee),
+    maxFee: asGwei(maxFeePerGas),
+  },
+}, null, 2));
diff --git a/scripts/relayer-cost-report.mjs b/scripts/relayer-cost-report.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..09ece32cc1fa74432fe6bccad637bd31bbd6ff86
--- /dev/null
+++ b/scripts/relayer-cost-report.mjs
@@ -0,0 +1,63 @@
+#!/usr/bin/env node
+
+// Usage: node scripts/relayer-cost-report.mjs tx-hashes.txt
+// The input is one Base transaction hash per line. Export these from the
+// relayer database; public Base RPCs cannot efficiently query by sender.
+import { readFile } from "node:fs/promises";
+
+const hashesFile = process.argv[2];
+if (!hashesFile) throw new Error("Usage: node scripts/relayer-cost-report.mjs tx-hashes.txt");
+const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
+const hashes = (await readFile(hashesFile, "utf8"))
+  .split(/\s+/)
+  .filter(Boolean)
+  .filter((hash, index, all) => all.indexOf(hash) === index);
+if (hashes.length === 0) throw new Error("No transaction hashes found");
+
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  const payload = await response.json();
+  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
+  return payload.result;
+}
+
+const priceResponse = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot");
+if (!priceResponse.ok) throw new Error("Could not fetch ETH/USD spot price");
+const ethUsd = Number((await priceResponse.json()).data.amount);
+const receipts = [];
+// Keep requests bounded so this can run against conservative public RPC limits.
+for (let i = 0; i < hashes.length; i += 20) {
+  const group = hashes.slice(i, i + 20);
+  receipts.push(...await Promise.all(group.map((hash) => rpc("eth_getTransactionReceipt", [hash]))));
+}
+
+let executionWei = 0n;
+let l1Wei = 0n;
+for (let i = 0; i < receipts.length; ++i) {
+  const receipt = receipts[i];
+  if (!receipt) throw new Error(`Receipt not found: ${hashes[i]}`);
+  executionWei += BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice);
+  // OP-stack receipts expose l1Fee. Treat its absence as zero, but surface it
+  // so a provider schema change cannot silently be mistaken for a saving.
+  l1Wei += receipt.l1Fee ? BigInt(receipt.l1Fee) : 0n;
+}
+const totalWei = executionWei + l1Wei;
+const weiToEth = (value) => Number(value) / 1e18;
+const usd = (value) => weiToEth(value) * ethUsd;
+console.log(JSON.stringify({
+  chainId: 8453,
+  transactions: receipts.length,
+  ethUsd,
+  executionWei: executionWei.toString(),
+  l1DataWei: l1Wei.toString(),
+  totalWei: totalWei.toString(),
+  executionUsd: usd(executionWei),
+  l1DataUsd: usd(l1Wei),
+  totalUsd: usd(totalWei),
+  averageUsdPerTransaction: usd(totalWei) / receipts.length,
+  receiptsWithoutL1Fee: receipts.filter((receipt) => !receipt.l1Fee).length,
+}, null, 2));
diff --git a/src/BatchPayer.sol b/src/BatchPayer.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4f61adeab92414abbddee11967b9b01dc3e7bc94
--- /dev/null
+++ b/src/BatchPayer.sol
@@ -0,0 +1,72 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+/// @notice Holds payment tokens and distributes them in one transaction.
+/// @dev Fund this contract directly. Do not use `transferFrom` for every
+/// recipient: the allowance update and extra call remove much of the benefit.
+contract BatchPayer {
+    error Unauthorized();
+    error ReentrantCall();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error TokenTransferFailed(uint256 index);
+
+    uint256 public constant MAX_RECIPIENTS = 200;
+
+    address public immutable owner;
+    uint256 private locked = 1;
+
+    event BatchPaid(address indexed token, uint256 recipients, uint256 total);
+
+    constructor(address owner_) {
+        if (owner_ == address(0)) revert Unauthorized();
+        owner = owner_;
+    }
+
+    modifier onlyOwner() {
+        if (msg.sender != owner) revert Unauthorized();
+        _;
+    }
+
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    /// @notice Pays every recipient from this contract's balance.
+    /// @dev Supports ERC-20s that either return true or return no value.
+    function pay(
+        address token,
+        address[] calldata recipients,
+        uint256[] calldata amounts
+    ) external onlyOwner nonReentrant {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_RECIPIENTS) revert BatchTooLarge();
+
+        uint256 total;
+        for (uint256 i; i < length; ++i) {
+            total += amounts[i];
+            _safeTransfer(token, recipients[i], amounts[i], i);
+        }
+        emit BatchPaid(token, length, total);
+    }
+
+    /// @notice Lets the owner recover a token after a failed or retired campaign.
+    function recover(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
+        _safeTransfer(token, recipient, amount, type(uint256).max);
+    }
+
+    function _safeTransfer(address token, address recipient, uint256 amount, uint256 index) private {
+        (bool ok, bytes memory result) = token.call(
+            abi.encodeWithSelector(0xa9059cbb, recipient, amount)
+        );
+        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) {
+            revert TokenTransferFailed(index);
+        }
+    }
+}
diff --git a/src/MockERC20.sol b/src/MockERC20.sol
new file mode 100644
index 0000000000000000000000000000000000000000..bb8a06b96f4fe162571487dcac3de39faff74b80
--- /dev/null
+++ b/src/MockERC20.sol
@@ -0,0 +1,16 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+contract MockERC20 {
+    mapping(address => uint256) public balanceOf;
+
+    constructor(address initialHolder, uint256 supply) {
+        balanceOf[initialHolder] = supply;
+    }
+
+    function transfer(address recipient, uint256 amount) external returns (bool) {
+        balanceOf[msg.sender] -= amount;
+        balanceOf[recipient] += amount;
+        return true;
+    }
+}
diff --git a/test/BatchPayer.t.sol b/test/BatchPayer.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a69fbb133ffa2fae928f964b5904de765df64db9
--- /dev/null
+++ b/test/BatchPayer.t.sol
@@ -0,0 +1,78 @@
+// SPDX-License-Identifier: MIT
+pragma solidity 0.8.24;
+
+import {BatchPayer} from "../src/BatchPayer.sol";
+import {MockERC20} from "../src/MockERC20.sol";
+
+interface Vm {
+    function prank(address) external;
+}
+
+contract BatchPayerTest {
+    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
+    address private constant OWNER = address(0xA11CE);
+    address private constant RECIPIENT_A = address(0xB0B);
+    address private constant RECIPIENT_B = address(0xCA01);
+    address private constant RECIPIENT_C = address(0xD0D);
+
+    BatchPayer private payer;
+    MockERC20 private token;
+
+    function setUp() public {
+        payer = new BatchPayer(OWNER);
+        token = new MockERC20(address(payer), 1_000_000);
+    }
+
+    function testPaysBatch() public {
+        address[] memory recipients = new address[](3);
+        recipients[0] = RECIPIENT_A;
+        recipients[1] = RECIPIENT_B;
+        recipients[2] = RECIPIENT_C;
+        uint256[] memory amounts = new uint256[](3);
+        amounts[0] = 11;
+        amounts[1] = 22;
+        amounts[2] = 33;
+
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+
+        require(token.balanceOf(RECIPIENT_A) == 11, "recipient A not paid");
+        require(token.balanceOf(RECIPIENT_B) == 22, "recipient B not paid");
+        require(token.balanceOf(RECIPIENT_C) == 33, "recipient C not paid");
+    }
+
+    function testRejectsNonOwner() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = RECIPIENT_A;
+        uint256[] memory amounts = new uint256[](1);
+        amounts[0] = 1;
+        (bool ok,) = address(payer).call(
+            abi.encodeCall(BatchPayer.pay, (address(token), recipients, amounts))
+        );
+        require(!ok, "non-owner paid");
+    }
+
+    // This is deliberately separate from the batch test so `forge test
+    // --gas-report` records the cost of the ordinary ERC-20 transfer too.
+    function testDirectTransfersBaseline() public {
+        MockERC20 directToken = new MockERC20(OWNER, 1_000_000);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_A, 11);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_B, 22);
+        vm.prank(OWNER);
+        directToken.transfer(RECIPIENT_C, 33);
+    }
+
+    function testPaysHundredRecipients() public {
+        address[] memory recipients = new address[](100);
+        uint256[] memory amounts = new uint256[](100);
+        for (uint256 i; i < 100; ++i) {
+            recipients[i] = address(uint160(i + 0x1000));
+            amounts[i] = 1;
+        }
+        vm.prank(OWNER);
+        payer.pay(address(token), recipients, amounts);
+        require(token.balanceOf(recipients[99]) == 1, "last recipient not paid");
+    }
+}

tokens used
66,259
````

## final message

Completed the cost plan and shipping code.

- Current measured run rate: about **$27.18/day**, **$815/month** at 40k transfers/day.
- Best known saving: 100-recipient batches, estimated **$397/month** reduction (validate with the real token before rollout).
- Added a Base receipt cost reporter and live EIP-1559 fee-policy helper.
- Added a tested `BatchPayer` contract with access control, reentrancy protection, recovery, and batching limits.

Key files:

- [PLAN.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002/PLAN.md)
- [BatchPayer.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002/src/BatchPayer.sol)
- [relayer-cost-report.mjs](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002/scripts/relayer-cost-report.mjs)
- [base-fee-policy.mjs](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T235913Z-codex-with-skill-3/gas-goal-002/scripts/base-fee-policy.mjs)

Verification passed: `forge test --gas-report` (4 tests).
