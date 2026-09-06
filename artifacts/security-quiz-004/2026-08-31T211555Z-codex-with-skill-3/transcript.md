# Executor transcript — 2026-08-31T211555Z-codex-with-skill-3

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /tmp/ethskills-security-eval/2026-08-31T211555Z-codex-with-skill-3/security-quiz-004

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-security-eval/2026-08-31T211555Z-codex-with-skill-3/security-quiz-004
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a059c0-c5f8-71a2-adcb-26ab272bdd9e
--------
user
Our treasury router on Ethereum mainnet pulls stablecoins in and forwards
them to a strategy contract, which it has to approve before each run. The
repo is on @openzeppelin/contracts v5 and Solidity 0.8.26.

The approval step is a low-level call, because an earlier version reverted
while decoding the return value of some tokens:

  (bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
  require(ok, "approve failed");

Three weeks of runs:

  - USDC (0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48): every run succeeds
  - USDT (0xdAC17F958D2ee523a2206206994597C13D831ec7): the FIRST run
    succeeded. Every run since reverts, always at that require, before any
    transfer happens
  - the strategy frequently spends less than it was approved for, so a
    leftover allowance from the previous run is normally still sitting there
  - the router holds enough ETH for gas, is not paused, is not on any
    blocklist, and the amounts are ordinary five-figure sums

Why does this fail only for USDT, and only after the first run? Give the
minimal change to the router that fixes it, and say what it should do about
the leftover allowance in general.

Write your answer to answer.md in this directory, showing your reasoning.

2026-08-31T21:36:41.205060Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a059c0-c5f8-71a2-adcb-26ab272bdd9e.tmp-1788212200960846970: line 2547: syntax error near unexpected token `('

codex
I’m inspecting the repo and loading the security skill first, then I’ll write the answer into `answer.md` with the reasoning tied to the USDT approval behavior.
exec
/bin/bash -lc 'pwd && rg --files' in /tmp/ethskills-security-eval/2026-08-31T211555Z-codex-with-skill-3/security-quiz-004
exec
/bin/bash -lc "sed -n '1,220p' /tmp/ethskills-security-eval/2026-08-31T211555Z-codex-with-skill-3/security-quiz-004/.agents/skills/security/SKILL.md" in /tmp/ethskills-security-eval/2026-08-31T211555Z-codex-with-skill-3/security-quiz-004
 succeeded in 20ms:
/tmp/ethskills-security-eval/2026-08-31T211555Z-codex-with-skill-3/security-quiz-004
package.json
TASK.md

 succeeded in 23ms:
---
name: security
description: Solidity security patterns, common vulnerabilities, and pre-deploy audit checklist. The specific code patterns that prevent real losses — not just warnings, but defensive implementations. Use before deploying any contract, when reviewing code, or when building anything that holds or moves value.
---

# Smart Contract Security

## What You Probably Got Wrong

**"Solidity 0.8+ prevents overflows, so I'm safe."** Overflow is one of dozens of attack vectors. The big ones today: reentrancy, oracle manipulation, approval exploits, and decimal mishandling.

**"I tested it and it works."** Working correctly is not the same as being secure. Most exploits call functions in orders or with values the developer never considered.

**"It's a small contract, it doesn't need an audit."** The DAO hack was a simple reentrancy bug. The Euler exploit was a single missing check. Size doesn't correlate with safety.

## Critical Vulnerabilities (With Defensive Code)

### 1. Token Decimals Vary

**USDC has 6 decimals, not 18.** This is the #1 source of "where did my money go?" bugs.

```solidity
// ❌ WRONG — assumes 18 decimals. Transfers 1 TRILLION USDC.
uint256 oneToken = 1e18;

// ✅ CORRECT — check decimals
uint256 oneToken = 10 ** IERC20Metadata(token).decimals();
```

Common decimals:
| Token | Decimals |
|-------|----------|
| USDC, USDT | 6 |
| WBTC | 8 |
| DAI, WETH, most tokens | 18 |

**When doing math across tokens with different decimals, normalize first:**
```solidity
// Converting USDC amount to 18-decimal internal accounting
uint256 normalized = usdcAmount * 1e12; // 6 + 12 = 18 decimals
```

### 2. No Floating Point in Solidity

Solidity has no `float` or `double`. Division truncates to zero.

```solidity
// ❌ WRONG — this equals 0
uint256 fivePercent = 5 / 100;

// ✅ CORRECT — basis points (1 bp = 0.01%)
uint256 FEE_BPS = 500; // 5% = 500 basis points
uint256 fee = (amount * FEE_BPS) / 10_000;
```

**Always multiply before dividing.** Division first = precision loss.

```solidity
// ❌ WRONG — loses precision
uint256 result = a / b * c;

// ✅ CORRECT — multiply first
uint256 result = (a * c) / b;
```

For complex math, use fixed-point libraries like `PRBMath` or `ABDKMath64x64`.

### 3. Reentrancy

An external call can call back into your contract before the first call finishes. If you update state AFTER the external call, the attacker re-enters with stale state.

```solidity
// ❌ VULNERABLE — state updated after external call
function withdraw() external {
    uint256 bal = balances[msg.sender];
    (bool success,) = msg.sender.call{value: bal}(""); // ← attacker re-enters here
    require(success);
    balances[msg.sender] = 0; // Too late — attacker already withdrew again
}

// ✅ SAFE — Checks-Effects-Interactions pattern + reentrancy guard
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

function withdraw() external nonReentrant {
    uint256 bal = balances[msg.sender];
    require(bal > 0, "Nothing to withdraw");
    
    balances[msg.sender] = 0;  // Effect BEFORE interaction
    
    (bool success,) = msg.sender.call{value: bal}("");
    require(success, "Transfer failed");
}
```

**The pattern: Checks → Effects → Interactions (CEI)**
1. **Checks** — validate inputs and conditions
2. **Effects** — update all state
3. **Interactions** — external calls last

Always use OpenZeppelin's `ReentrancyGuard` as a safety net on top of CEI.

### 4. SafeERC20

Some tokens (notably USDT) don't return `bool` on `transfer()` and `approve()`. Standard calls will revert even on success.

```solidity
// ❌ WRONG — breaks with USDT and other non-standard tokens
token.transfer(to, amount);
token.approve(spender, amount);

// ✅ CORRECT — handles all token implementations
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
using SafeERC20 for IERC20;

token.safeTransfer(to, amount);
token.safeApprove(spender, amount);
```

**Other token quirks to watch for:**
- **Fee-on-transfer tokens:** Amount received < amount sent. Always check balance before and after.
- **Rebasing tokens (stETH):** Balance changes without transfers. Use wrapped versions (wstETH).
- **Pausable tokens (USDC):** Transfers can revert if the token is paused.
- **Blocklist tokens (USDC, USDT):** Specific addresses can be blocked from transacting.

### 5. Never Use DEX Spot Prices as Oracles

A flash loan can manipulate any pool's spot price within a single transaction. This has caused hundreds of millions in losses.

```solidity
// ❌ DANGEROUS — manipulable in one transaction
function getPrice() internal view returns (uint256) {
    (uint112 reserve0, uint112 reserve1,) = uniswapPair.getReserves();
    return (reserve1 * 1e18) / reserve0; // Spot price — easily manipulated
}

// ✅ SAFE — Chainlink with staleness + sanity checks
function getPrice() internal view returns (uint256) {
    (, int256 price,, uint256 updatedAt,) = priceFeed.latestRoundData();
    require(block.timestamp - updatedAt < 3600, "Stale price");
    require(price > 0, "Invalid price");
    return uint256(price);
}
```

**If you must use onchain price data:**
- Use **TWAP** (Time-Weighted Average Price) over 30+ minutes — resistant to single-block manipulation
- Uniswap V3 has built-in TWAP oracles via `observe()` (verified addresses: `addresses/SKILL.md`)
- Still less safe than Chainlink for high-value decisions

### 6. Vault Inflation Attack

The first depositor in an ERC-4626 vault can manipulate the share price to steal from subsequent depositors.

**The attack:**
1. Attacker deposits 1 wei → gets 1 share
2. Attacker donates 1000 tokens directly to the vault (not via deposit)
3. Now 1 share = 1001 tokens
4. Victim deposits 1999 tokens → gets `1999 * 1 / 2000 = 0 shares` (rounds down)
5. Attacker redeems 1 share → gets all 3000 tokens

**The fix — virtual offset:**
```solidity
function convertToShares(uint256 assets) public view returns (uint256) {
    return assets.mulDiv(
        totalSupply() + 1e3,    // Virtual shares
        totalAssets() + 1        // Virtual assets
    );
}
```

The virtual offset makes the attack uneconomical — the attacker would need to donate enormous amounts to manipulate the ratio.

OpenZeppelin's ERC4626 implementation includes this mitigation by default since v5.

### 7. Infinite Approvals

**Never use `type(uint256).max` as approval amount.**

```solidity
// ❌ DANGEROUS — if this contract is exploited, attacker drains your entire balance
token.approve(someContract, type(uint256).max);

// ✅ SAFE — approve only what's needed
token.approve(someContract, exactAmountNeeded);

// ✅ ACCEPTABLE — approve a small multiple for repeated interactions
token.approve(someContract, amountPerTx * 5); // 5 transactions worth
```

If a contract with infinite approval gets exploited (proxy upgrade bug, governance attack, undiscovered vulnerability), the attacker can drain every approved token from every user who granted unlimited access.

### 8. Access Control

Every state-changing function needs explicit access control. "Who should be able to call this?" is the first question.

```solidity
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// ❌ WRONG — anyone can drain the contract
function emergencyWithdraw() external {
    token.transfer(msg.sender, token.balanceOf(address(this)));
}

// ✅ CORRECT — only owner
function emergencyWithdraw() external onlyOwner {
    token.transfer(owner(), token.balanceOf(address(this)));
}
```

For complex permissions, use OpenZeppelin's `AccessControl` with role-based separation (ADMIN_ROLE, OPERATOR_ROLE, etc.).

### 9. Input Validation

Never trust inputs. Validate everything.

```solidity
function deposit(uint256 amount, address recipient) external {
    require(amount > 0, "Zero amount");
    require(recipient != address(0), "Zero address");
    require(amount <= maxDeposit, "Exceeds max");

codex
I’ve loaded the security guidance. Next I’m checking the task file and then I’ll write a concise root-cause analysis plus the minimal router fix into `answer.md`.
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /tmp/ethskills-security-eval/2026-08-31T211555Z-codex-with-skill-3/security-quiz-004
 succeeded in 8ms:
Our treasury router on Ethereum mainnet pulls stablecoins in and forwards
them to a strategy contract, which it has to approve before each run. The
repo is on @openzeppelin/contracts v5 and Solidity 0.8.26.

The approval step is a low-level call, because an earlier version reverted
while decoding the return value of some tokens:

  (bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
  require(ok, "approve failed");

Three weeks of runs:

  - USDC (0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48): every run succeeds
  - USDT (0xdAC17F958D2ee523a2206206994597C13D831ec7): the FIRST run
    succeeded. Every run since reverts, always at that require, before any
    transfer happens
  - the strategy frequently spends less than it was approved for, so a
    leftover allowance from the previous run is normally still sitting there
  - the router holds enough ETH for gas, is not paused, is not on any
    blocklist, and the amounts are ordinary five-figure sums

Why does this fail only for USDT, and only after the first run? Give the
minimal change to the router that fixes it, and say what it should do about
the leftover allowance in general.

Write your answer to answer.md in this directory, showing your reasoning.

exec
/bin/bash -lc 'git status --short' in /tmp/ethskills-security-eval/2026-08-31T211555Z-codex-with-skill-3/security-quiz-004
 succeeded in 5ms:
codex
I have enough context. I’m writing the answer now, centered on USDT’s non-standard approval rule and the allowance-handling pattern the router should use going forward.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211555Z-codex-with-skill-3/security-quiz-004/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..7eec4cdfe1ce2c3bf65659e704e7b199066ac938
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,65 @@
+The failure pattern matches **USDT's non-standard `approve` behavior**.
+
+Reasoning:
+
+1. The router is calling `approve(strategy, amount)` before each run.
+2. On the first USDT run, the prior allowance was presumably `0`, so the approval succeeded.
+3. After that run, the strategy often spent **less** than the approved amount, so the router was left with a **non-zero allowance** to the strategy.
+4. USDT does not reliably allow changing a non-zero allowance directly to another non-zero allowance. Its approval flow effectively requires:
+   - first set allowance to `0`
+   - then set the new non-zero allowance
+5. Because the router uses a low-level call and only checks `ok`, the second and later USDT runs fail exactly at:
+
+```solidity
+require(ok, "approve failed");
+```
+
+That also explains why:
+
+- **USDC keeps working**: USDC allows ordinary repeated `approve(spender, amount)` updates.
+- **USDT fails only after the first run**: only then is there usually a leftover non-zero allowance.
+
+The minimal router change is to use OpenZeppelin's USDT-compatible approval helper instead of the raw low-level `approve` call:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+`forceApprove` in OpenZeppelin v5 handles the exact USDT case by falling back to:
+
+1. `approve(spender, 0)`
+2. `approve(spender, amount)`
+
+when a direct approval update does not work.
+
+If the router wants to stay with manual calls, the equivalent minimal logic is:
+
+```solidity
+IERC20 erc20 = IERC20(token);
+uint256 current = erc20.allowance(address(this), strategy);
+if (current != 0) {
+    erc20.forceApprove(strategy, 0);
+}
+erc20.forceApprove(strategy, amount);
+```
+
+But with OZ v5, the cleaner minimal fix is simply:
+
+```solidity
+IERC20(token).forceApprove(strategy, amount);
+```
+
+About leftover allowance in general:
+
+- The router should **not assume leftover allowance is harmless**.
+- Any unused allowance is standing permission for the strategy to pull more tokens later.
+- Best practice is to grant only the allowance needed for the current run, and after the strategy finishes, **reset leftover allowance back to `0`** unless there is a deliberate reason to keep it.
+
+So the general policy should be:
+
+- before use: set the exact allowance needed, using `forceApprove`
+- after use: clear any remaining allowance back to `0`
+
+That minimizes approval risk and also avoids USDT's zero-first approval requirement causing future runs to revert.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..7eec4cdfe1ce2c3bf65659e704e7b199066ac938
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,65 @@
+The failure pattern matches **USDT's non-standard `approve` behavior**.
+
+Reasoning:
+
+1. The router is calling `approve(strategy, amount)` before each run.
+2. On the first USDT run, the prior allowance was presumably `0`, so the approval succeeded.
+3. After that run, the strategy often spent **less** than the approved amount, so the router was left with a **non-zero allowance** to the strategy.
+4. USDT does not reliably allow changing a non-zero allowance directly to another non-zero allowance. Its approval flow effectively requires:
+   - first set allowance to `0`
+   - then set the new non-zero allowance
+5. Because the router uses a low-level call and only checks `ok`, the second and later USDT runs fail exactly at:
+
+```solidity
+require(ok, "approve failed");
+```
+
+That also explains why:
+
+- **USDC keeps working**: USDC allows ordinary repeated `approve(spender, amount)` updates.
+- **USDT fails only after the first run**: only then is there usually a leftover non-zero allowance.
+
+The minimal router change is to use OpenZeppelin's USDT-compatible approval helper instead of the raw low-level `approve` call:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+`forceApprove` in OpenZeppelin v5 handles the exact USDT case by falling back to:
+
+1. `approve(spender, 0)`
+2. `approve(spender, amount)`
+
+when a direct approval update does not work.
+
+If the router wants to stay with manual calls, the equivalent minimal logic is:
+
+```solidity
+IERC20 erc20 = IERC20(token);
+uint256 current = erc20.allowance(address(this), strategy);
+if (current != 0) {
+    erc20.forceApprove(strategy, 0);
+}
+erc20.forceApprove(strategy, amount);
+```
+
+But with OZ v5, the cleaner minimal fix is simply:
+
+```solidity
+IERC20(token).forceApprove(strategy, amount);
+```
+
+About leftover allowance in general:
+
+- The router should **not assume leftover allowance is harmless**.
+- Any unused allowance is standing permission for the strategy to pull more tokens later.
+- Best practice is to grant only the allowance needed for the current run, and after the strategy finishes, **reset leftover allowance back to `0`** unless there is a deliberate reason to keep it.
+
+So the general policy should be:
+
+- before use: set the exact allowance needed, using `forceApprove`
+- after use: clear any remaining allowance back to `0`
+
+That minimizes approval risk and also avoids USDT's zero-first approval requirement causing future runs to revert.

codex
`answer.md` is in place. I’m doing a quick readback for correctness and then I’ll close with the exact file path.
exec
/bin/bash -lc "sed -n '1,240p' answer.md" in /tmp/ethskills-security-eval/2026-08-31T211555Z-codex-with-skill-3/security-quiz-004
 succeeded in 17ms:
The failure pattern matches **USDT's non-standard `approve` behavior**.

Reasoning:

1. The router is calling `approve(strategy, amount)` before each run.
2. On the first USDT run, the prior allowance was presumably `0`, so the approval succeeded.
3. After that run, the strategy often spent **less** than the approved amount, so the router was left with a **non-zero allowance** to the strategy.
4. USDT does not reliably allow changing a non-zero allowance directly to another non-zero allowance. Its approval flow effectively requires:
   - first set allowance to `0`
   - then set the new non-zero allowance
5. Because the router uses a low-level call and only checks `ok`, the second and later USDT runs fail exactly at:

```solidity
require(ok, "approve failed");
```

That also explains why:

- **USDC keeps working**: USDC allows ordinary repeated `approve(spender, amount)` updates.
- **USDT fails only after the first run**: only then is there usually a leftover non-zero allowance.

The minimal router change is to use OpenZeppelin's USDT-compatible approval helper instead of the raw low-level `approve` call:

```solidity
using SafeERC20 for IERC20;

IERC20(token).forceApprove(strategy, amount);
```

`forceApprove` in OpenZeppelin v5 handles the exact USDT case by falling back to:

1. `approve(spender, 0)`
2. `approve(spender, amount)`

when a direct approval update does not work.

If the router wants to stay with manual calls, the equivalent minimal logic is:

```solidity
IERC20 erc20 = IERC20(token);
uint256 current = erc20.allowance(address(this), strategy);
if (current != 0) {
    erc20.forceApprove(strategy, 0);
}
erc20.forceApprove(strategy, amount);
```

But with OZ v5, the cleaner minimal fix is simply:

```solidity
IERC20(token).forceApprove(strategy, amount);
```

About leftover allowance in general:

- The router should **not assume leftover allowance is harmless**.
- Any unused allowance is standing permission for the strategy to pull more tokens later.
- Best practice is to grant only the allowance needed for the current run, and after the strategy finishes, **reset leftover allowance back to `0`** unless there is a deliberate reason to keep it.

So the general policy should be:

- before use: set the exact allowance needed, using `forceApprove`
- after use: clear any remaining allowance back to `0`

That minimizes approval risk and also avoids USDT's zero-first approval requirement causing future runs to revert.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..7eec4cdfe1ce2c3bf65659e704e7b199066ac938
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,65 @@
+The failure pattern matches **USDT's non-standard `approve` behavior**.
+
+Reasoning:
+
+1. The router is calling `approve(strategy, amount)` before each run.
+2. On the first USDT run, the prior allowance was presumably `0`, so the approval succeeded.
+3. After that run, the strategy often spent **less** than the approved amount, so the router was left with a **non-zero allowance** to the strategy.
+4. USDT does not reliably allow changing a non-zero allowance directly to another non-zero allowance. Its approval flow effectively requires:
+   - first set allowance to `0`
+   - then set the new non-zero allowance
+5. Because the router uses a low-level call and only checks `ok`, the second and later USDT runs fail exactly at:
+
+```solidity
+require(ok, "approve failed");
+```
+
+That also explains why:
+
+- **USDC keeps working**: USDC allows ordinary repeated `approve(spender, amount)` updates.
+- **USDT fails only after the first run**: only then is there usually a leftover non-zero allowance.
+
+The minimal router change is to use OpenZeppelin's USDT-compatible approval helper instead of the raw low-level `approve` call:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+`forceApprove` in OpenZeppelin v5 handles the exact USDT case by falling back to:
+
+1. `approve(spender, 0)`
+2. `approve(spender, amount)`
+
+when a direct approval update does not work.
+
+If the router wants to stay with manual calls, the equivalent minimal logic is:
+
+```solidity
+IERC20 erc20 = IERC20(token);
+uint256 current = erc20.allowance(address(this), strategy);
+if (current != 0) {
+    erc20.forceApprove(strategy, 0);
+}
+erc20.forceApprove(strategy, amount);
+```
+
+But with OZ v5, the cleaner minimal fix is simply:
+
+```solidity
+IERC20(token).forceApprove(strategy, amount);
+```
+
+About leftover allowance in general:
+
+- The router should **not assume leftover allowance is harmless**.
+- Any unused allowance is standing permission for the strategy to pull more tokens later.
+- Best practice is to grant only the allowance needed for the current run, and after the strategy finishes, **reset leftover allowance back to `0`** unless there is a deliberate reason to keep it.
+
+So the general policy should be:
+
+- before use: set the exact allowance needed, using `forceApprove`
+- after use: clear any remaining allowance back to `0`
+
+That minimizes approval risk and also avoids USDT's zero-first approval requirement causing future runs to revert.

codex
Wrote the answer to [answer.md](/tmp/ethskills-security-eval/2026-08-31T211555Z-codex-with-skill-3/security-quiz-004/answer.md).

It explains that USDT fails after the first run because it rejects changing a non-zero allowance directly to another non-zero allowance, while leftover allowance remains from prior runs. The minimal fix is to replace the raw low-level `approve` with OpenZeppelin v5 `SafeERC20.forceApprove`, and in general the router should clear leftover allowance back to `0` after use rather than leaving standing approval in place.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..7eec4cdfe1ce2c3bf65659e704e7b199066ac938
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,65 @@
+The failure pattern matches **USDT's non-standard `approve` behavior**.
+
+Reasoning:
+
+1. The router is calling `approve(strategy, amount)` before each run.
+2. On the first USDT run, the prior allowance was presumably `0`, so the approval succeeded.
+3. After that run, the strategy often spent **less** than the approved amount, so the router was left with a **non-zero allowance** to the strategy.
+4. USDT does not reliably allow changing a non-zero allowance directly to another non-zero allowance. Its approval flow effectively requires:
+   - first set allowance to `0`
+   - then set the new non-zero allowance
+5. Because the router uses a low-level call and only checks `ok`, the second and later USDT runs fail exactly at:
+
+```solidity
+require(ok, "approve failed");
+```
+
+That also explains why:
+
+- **USDC keeps working**: USDC allows ordinary repeated `approve(spender, amount)` updates.
+- **USDT fails only after the first run**: only then is there usually a leftover non-zero allowance.
+
+The minimal router change is to use OpenZeppelin's USDT-compatible approval helper instead of the raw low-level `approve` call:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+`forceApprove` in OpenZeppelin v5 handles the exact USDT case by falling back to:
+
+1. `approve(spender, 0)`
+2. `approve(spender, amount)`
+
+when a direct approval update does not work.
+
+If the router wants to stay with manual calls, the equivalent minimal logic is:
+
+```solidity
+IERC20 erc20 = IERC20(token);
+uint256 current = erc20.allowance(address(this), strategy);
+if (current != 0) {
+    erc20.forceApprove(strategy, 0);
+}
+erc20.forceApprove(strategy, amount);
+```
+
+But with OZ v5, the cleaner minimal fix is simply:
+
+```solidity
+IERC20(token).forceApprove(strategy, amount);
+```
+
+About leftover allowance in general:
+
+- The router should **not assume leftover allowance is harmless**.
+- Any unused allowance is standing permission for the strategy to pull more tokens later.
+- Best practice is to grant only the allowance needed for the current run, and after the strategy finishes, **reset leftover allowance back to `0`** unless there is a deliberate reason to keep it.
+
+So the general policy should be:
+
+- before use: set the exact allowance needed, using `forceApprove`
+- after use: clear any remaining allowance back to `0`
+
+That minimizes approval risk and also avoids USDT's zero-first approval requirement causing future runs to revert.

tokens used
12,368
````

## final message

Wrote the answer to [answer.md](/tmp/ethskills-security-eval/2026-08-31T211555Z-codex-with-skill-3/security-quiz-004/answer.md).

It explains that USDT fails after the first run because it rejects changing a non-zero allowance directly to another non-zero allowance, while leftover allowance remains from prior runs. The minimal fix is to replace the raw low-level `approve` with OpenZeppelin v5 `SafeERC20.forceApprove`, and in general the router should clear leftover allowance back to `0` after use rather than leaving standing approval in place.
