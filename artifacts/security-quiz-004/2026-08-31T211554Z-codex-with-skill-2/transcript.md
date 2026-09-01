# Executor transcript — 2026-08-31T211554Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /tmp/ethskills-security-eval/2026-08-31T211554Z-codex-with-skill-2/security-quiz-004

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-security-eval/2026-08-31T211554Z-codex-with-skill-2/security-quiz-004
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a059c0-98a9-7dd1-b237-2c98f914aa5f
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

2026-08-31T21:36:29.601670Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a059c0-98a9-7dd1-b237-2c98f914aa5f.tmp-1788212189363519349: line 2547: syntax error near unexpected token `('

codex
I’m using the `security` skill for this Solidity allowance issue. First I’m reading the skill instructions and then I’ll inspect the repo state before writing `answer.md`.
exec
/bin/bash -lc "sed -n '1,220p' .agents/skills/security/SKILL.md" in /tmp/ethskills-security-eval/2026-08-31T211554Z-codex-with-skill-2/security-quiz-004
 succeeded in 17ms:
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

exec
/bin/bash -lc 'rg --files' in /tmp/ethskills-security-eval/2026-08-31T211554Z-codex-with-skill-2/security-quiz-004
 succeeded in 19ms:
package.json
TASK.md

codex
I’ve confirmed this is the classic non-standard allowance edge case, and I’m checking the task file for any repo-specific answer constraints before writing the fix and rationale into `answer.md`.
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /tmp/ethskills-security-eval/2026-08-31T211554Z-codex-with-skill-2/security-quiz-004
 succeeded in 15ms:
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
/bin/bash -lc "if [ -f answer.md ]; then sed -n '1,220p' answer.md; fi" in /tmp/ethskills-security-eval/2026-08-31T211554Z-codex-with-skill-2/security-quiz-004
 succeeded in 7ms:
codex
I have the fix: the router is tripping USDT’s “non-zero to non-zero approve” restriction. I’m writing the answer with the minimal OpenZeppelin v5 change and the allowance-handling rule that falls out of it.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211554Z-codex-with-skill-2/security-quiz-004/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..c761421817abd8d7fddcb6acd9be84fa324cf7bb
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,38 @@
+The failure pattern matches USDT's well-known approval behavior.
+
+Reasoning:
+
+1. The first USDT run succeeds because the router starts with `allowance(router, strategy) == 0`, so `approve(strategy, amount)` is a zero-to-nonzero approval.
+2. Later runs fail because the strategy often spends less than it was approved for, so a nonzero leftover allowance remains.
+3. USDT does not allow changing an existing nonzero allowance directly to another nonzero allowance. It requires setting the allowance to zero first, then setting the new value.
+4. Your low-level call only checks whether the token call reverted:
+
+```solidity
+(bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
+require(ok, "approve failed");
+```
+
+For USDT after the first run, that `approve(strategy, amount)` call itself reverts because the current allowance is still nonzero, so `ok == false` and the router stops at `require(ok, "approve failed")`.
+5. USDC does not enforce that zero-first rule, so repeated approvals continue to succeed there.
+
+Minimal router change:
+
+Since the repo is already on OpenZeppelin Contracts v5, replace the low-level approval with `SafeERC20.forceApprove`, which is specifically meant to handle tokens like USDT.
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+`forceApprove` first tries the normal approval. If that fails, it falls back to `approve(spender, 0)` and then `approve(spender, value)`, which fixes the USDT case without you needing to hand-roll low-level logic.
+
+What the router should do about leftover allowance in general:
+
+- Do not assume the next exact-amount approval can overwrite a leftover allowance.
+- In general, approvals should be for the exact amount needed, and stale allowance should not be left sitting around longer than necessary.
+- Practically, that means either:
+  - use `forceApprove(strategy, amount)` before each run, which safely resets when needed, and/or
+  - clear any leftover allowance back to zero after the strategy is done spending, if your flow allows that.
+
+The safest general rule is: avoid persistent leftover allowance where possible, and when resetting allowance for another run, handle the nonzero-to-nonzero case explicitly. On OpenZeppelin v5, `forceApprove` is the minimal correct fix.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..c761421817abd8d7fddcb6acd9be84fa324cf7bb
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,38 @@
+The failure pattern matches USDT's well-known approval behavior.
+
+Reasoning:
+
+1. The first USDT run succeeds because the router starts with `allowance(router, strategy) == 0`, so `approve(strategy, amount)` is a zero-to-nonzero approval.
+2. Later runs fail because the strategy often spends less than it was approved for, so a nonzero leftover allowance remains.
+3. USDT does not allow changing an existing nonzero allowance directly to another nonzero allowance. It requires setting the allowance to zero first, then setting the new value.
+4. Your low-level call only checks whether the token call reverted:
+
+```solidity
+(bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
+require(ok, "approve failed");
+```
+
+For USDT after the first run, that `approve(strategy, amount)` call itself reverts because the current allowance is still nonzero, so `ok == false` and the router stops at `require(ok, "approve failed")`.
+5. USDC does not enforce that zero-first rule, so repeated approvals continue to succeed there.
+
+Minimal router change:
+
+Since the repo is already on OpenZeppelin Contracts v5, replace the low-level approval with `SafeERC20.forceApprove`, which is specifically meant to handle tokens like USDT.
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+`forceApprove` first tries the normal approval. If that fails, it falls back to `approve(spender, 0)` and then `approve(spender, value)`, which fixes the USDT case without you needing to hand-roll low-level logic.
+
+What the router should do about leftover allowance in general:
+
+- Do not assume the next exact-amount approval can overwrite a leftover allowance.
+- In general, approvals should be for the exact amount needed, and stale allowance should not be left sitting around longer than necessary.
+- Practically, that means either:
+  - use `forceApprove(strategy, amount)` before each run, which safely resets when needed, and/or
+  - clear any leftover allowance back to zero after the strategy is done spending, if your flow allows that.
+
+The safest general rule is: avoid persistent leftover allowance where possible, and when resetting allowance for another run, handle the nonzero-to-nonzero case explicitly. On OpenZeppelin v5, `forceApprove` is the minimal correct fix.

codex
Wrote the answer to [answer.md](/tmp/ethskills-security-eval/2026-08-31T211554Z-codex-with-skill-2/security-quiz-004/answer.md).

Core point: USDT rejects changing a nonzero allowance directly to another nonzero allowance, so the first run works from zero and later runs fail because leftover allowance remains. The minimal OpenZeppelin v5 fix is to replace the low-level `approve` call with `SafeERC20.forceApprove(...)`, which zeroes first when needed.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..c761421817abd8d7fddcb6acd9be84fa324cf7bb
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,38 @@
+The failure pattern matches USDT's well-known approval behavior.
+
+Reasoning:
+
+1. The first USDT run succeeds because the router starts with `allowance(router, strategy) == 0`, so `approve(strategy, amount)` is a zero-to-nonzero approval.
+2. Later runs fail because the strategy often spends less than it was approved for, so a nonzero leftover allowance remains.
+3. USDT does not allow changing an existing nonzero allowance directly to another nonzero allowance. It requires setting the allowance to zero first, then setting the new value.
+4. Your low-level call only checks whether the token call reverted:
+
+```solidity
+(bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
+require(ok, "approve failed");
+```
+
+For USDT after the first run, that `approve(strategy, amount)` call itself reverts because the current allowance is still nonzero, so `ok == false` and the router stops at `require(ok, "approve failed")`.
+5. USDC does not enforce that zero-first rule, so repeated approvals continue to succeed there.
+
+Minimal router change:
+
+Since the repo is already on OpenZeppelin Contracts v5, replace the low-level approval with `SafeERC20.forceApprove`, which is specifically meant to handle tokens like USDT.
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+`forceApprove` first tries the normal approval. If that fails, it falls back to `approve(spender, 0)` and then `approve(spender, value)`, which fixes the USDT case without you needing to hand-roll low-level logic.
+
+What the router should do about leftover allowance in general:
+
+- Do not assume the next exact-amount approval can overwrite a leftover allowance.
+- In general, approvals should be for the exact amount needed, and stale allowance should not be left sitting around longer than necessary.
+- Practically, that means either:
+  - use `forceApprove(strategy, amount)` before each run, which safely resets when needed, and/or
+  - clear any leftover allowance back to zero after the strategy is done spending, if your flow allows that.
+
+The safest general rule is: avoid persistent leftover allowance where possible, and when resetting allowance for another run, handle the nonzero-to-nonzero case explicitly. On OpenZeppelin v5, `forceApprove` is the minimal correct fix.

tokens used
10,865
````

## final message

Wrote the answer to [answer.md](/tmp/ethskills-security-eval/2026-08-31T211554Z-codex-with-skill-2/security-quiz-004/answer.md).

Core point: USDT rejects changing a nonzero allowance directly to another nonzero allowance, so the first run works from zero and later runs fail because leftover allowance remains. The minimal OpenZeppelin v5 fix is to replace the low-level `approve` call with `SafeERC20.forceApprove(...)`, which zeroes first when needed.
