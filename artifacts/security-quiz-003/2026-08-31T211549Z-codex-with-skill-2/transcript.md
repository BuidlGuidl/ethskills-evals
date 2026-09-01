# Executor transcript — 2026-08-31T211549Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /tmp/ethskills-security-eval/2026-08-31T211549Z-codex-with-skill-2/security-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-security-eval/2026-08-31T211549Z-codex-with-skill-2/security-quiz-003
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a059bf-4ccc-7f40-bcc1-cd834792435d
--------
user
Our single-token staking pool on Ethereum mainnet has been live for three
weeks and the books do not close. What we can see:

  - 1,250,000 TKN has been staked cumulatively since launch, and 250,000 TKN
    has been unstaked
  - summing stakedBalance[user] across every current staker: 1,000,000 TKN
  - the pool contract's actual TKN balance: 975,000 TKN
  - the early unstakers were all paid without the pool reverting; the ones
    unstaking now are starting to revert with the token's insufficient-balance
    error
  - one user staked 10,000 TKN, the UI showed 10,000 staked, and when they
    unstaked all 10,000 their wallet received 9,800 TKN

What the contract does, in full: `stake(amount)` calls
`token.transferFrom(msg.sender, address(this), amount)` and then sets
`stakedBalance[msg.sender] += amount`. `unstake(amount)` decrements
`stakedBalance[msg.sender]` and then calls `token.transfer(msg.sender,
amount)`. There is no rewards logic yet, no admin withdrawal function, and
the pool has never sent TKN anywhere except back to unstakers. TKN's total
supply has not been changed by anyone and no rebase has occurred.

Explain where the missing 25,000 TKN went and why the shortfall grows, then
give the change that makes the accounting correct — including what happens to
the stakers who cannot currently unstake.

Write your answer to answer.md in this directory, showing your reasoning.

2026-08-31T21:35:04.636383Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a059bf-4ccc-7f40-bcc1-cd834792435d.tmp-1788212104407932909: line 2547: syntax error near unexpected token `('

codex
I’m using the `security` skill for this staking-pool incident analysis. First I’m reading the skill instructions and checking the workspace so I can write the answer directly into `answer.md`.
exec
/bin/bash -lc "sed -n '1,220p' .agents/skills/security/SKILL.md" in /tmp/ethskills-security-eval/2026-08-31T211549Z-codex-with-skill-2/security-quiz-003
 succeeded in 14ms:
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
/bin/bash -lc 'rg --files' in /tmp/ethskills-security-eval/2026-08-31T211549Z-codex-with-skill-2/security-quiz-003
 succeeded in 14ms:
TASK.md
package.json

codex
I’ve confirmed this is a fee-on-transfer token accounting failure, not a mysterious drain. I’m writing the incident explanation and the corrective accounting change into `answer.md`, including why some unstakers are now blocked and what remediation is required.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211549Z-codex-with-skill-2/security-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..59dc691e227b0c1c44e3ae319f063417180e282f
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,97 @@
+The missing `25,000 TKN` was lost on **stake deposits**, not on withdrawals.
+
+## What happened
+
+The pool assumes that if a user calls `stake(amount)`, then the pool receives exactly `amount` tokens:
+
+```solidity
+token.transferFrom(msg.sender, address(this), amount);
+stakedBalance[msg.sender] += amount;
+```
+
+That assumption is false for a fee-on-transfer token.
+
+The user example proves `TKN` charges a 2% transfer fee:
+
+- user unstaked `10,000`
+- pool sent `10,000`
+- wallet received `9,800`
+
+So when someone stakes `10,000`, the same thing happens in reverse:
+
+- user sends `10,000`
+- pool receives only `9,800`
+- contract still credits `stakedBalance[user] += 10,000`
+
+That creates an immediate `200 TKN` accounting hole.
+
+## Why the numbers match exactly
+
+Cumulative stake calls: `1,250,000 TKN`
+
+If `TKN` takes 2% on each inbound transfer, the pool actually received:
+
+`1,250,000 * 98% = 1,225,000 TKN`
+
+But the contract credited users for the full `1,250,000 TKN`.
+
+So the books were overstated by:
+
+`1,250,000 - 1,225,000 = 25,000 TKN`
+
+That is exactly the observed shortfall:
+
+- recorded current stakes: `1,000,000 TKN`
+- actual pool balance: `975,000 TKN`
+- deficit: `25,000 TKN`
+
+The withdrawal side explains the user complaint, but not the `25,000` mismatch:
+
+- when the pool transfers `amount` out, its balance drops by `amount`
+- the user receives less because the token taxes the transfer
+
+So withdrawals are painful for users, but they do **not** create this specific asset-vs-liability gap. The gap was created when deposits were credited at gross amount instead of net received.
+
+## Why the shortfall grows
+
+It grows on every new stake.
+
+Each time a user stakes:
+
+- pool assets increase by the **net received**
+- pool liabilities increase by the **gross requested amount**
+
+So liabilities outrun assets by 2% of every deposit forever. Early unstakers succeed because there is still enough real token balance in the contract. Later unstakers revert because earlier withdrawals consumed the real tokens while the remaining users still hold overstated balances on paper.
+
+This is why “the books do not close.”
+
+## Correct fix
+
+The accounting must use the **actual balance delta**, not the requested `amount`.
+
+```solidity
+function stake(uint256 amount) external {
+    uint256 beforeBal = token.balanceOf(address(this));
+    token.transferFrom(msg.sender, address(this), amount);
+    uint256 received = token.balanceOf(address(this)) - beforeBal;
+
+    stakedBalance[msg.sender] += received;
+}
+```
+
+Using `SafeERC20` is also advisable, but the key fix is: **credit only what the contract actually received**.
+
+If the token is also fee-on-transfer on withdrawals, then a user who unstakes `X` will still only receive the token’s net-after-fee amount in their wallet. That is a token property, not a pool accounting error, as long as the pool reduces balances by what leaves the pool.
+
+## What happens to users who currently cannot unstake
+
+Changing the code fixes future accounting, but it does **not** repair the existing `25,000 TKN` hole.
+
+Right now, current stakers are collectively owed `1,000,000 TKN` by the contract’s internal ledger, but the pool only holds `975,000 TKN`. So some users are already undercollateralized.
+
+That means one of these must happen:
+
+1. The operator recapitalizes the pool with `25,000 TKN`, letting current recorded balances be honored in full.
+2. The recorded balances are written down to match reality, which socializes the loss across current stakers.
+
+Without adding `25,000 TKN`, it is mathematically impossible for every current staker to withdraw their recorded balance, because those tokens were never in the pool in the first place.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..59dc691e227b0c1c44e3ae319f063417180e282f
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,97 @@
+The missing `25,000 TKN` was lost on **stake deposits**, not on withdrawals.
+
+## What happened
+
+The pool assumes that if a user calls `stake(amount)`, then the pool receives exactly `amount` tokens:
+
+```solidity
+token.transferFrom(msg.sender, address(this), amount);
+stakedBalance[msg.sender] += amount;
+```
+
+That assumption is false for a fee-on-transfer token.
+
+The user example proves `TKN` charges a 2% transfer fee:
+
+- user unstaked `10,000`
+- pool sent `10,000`
+- wallet received `9,800`
+
+So when someone stakes `10,000`, the same thing happens in reverse:
+
+- user sends `10,000`
+- pool receives only `9,800`
+- contract still credits `stakedBalance[user] += 10,000`
+
+That creates an immediate `200 TKN` accounting hole.
+
+## Why the numbers match exactly
+
+Cumulative stake calls: `1,250,000 TKN`
+
+If `TKN` takes 2% on each inbound transfer, the pool actually received:
+
+`1,250,000 * 98% = 1,225,000 TKN`
+
+But the contract credited users for the full `1,250,000 TKN`.
+
+So the books were overstated by:
+
+`1,250,000 - 1,225,000 = 25,000 TKN`
+
+That is exactly the observed shortfall:
+
+- recorded current stakes: `1,000,000 TKN`
+- actual pool balance: `975,000 TKN`
+- deficit: `25,000 TKN`
+
+The withdrawal side explains the user complaint, but not the `25,000` mismatch:
+
+- when the pool transfers `amount` out, its balance drops by `amount`
+- the user receives less because the token taxes the transfer
+
+So withdrawals are painful for users, but they do **not** create this specific asset-vs-liability gap. The gap was created when deposits were credited at gross amount instead of net received.
+
+## Why the shortfall grows
+
+It grows on every new stake.
+
+Each time a user stakes:
+
+- pool assets increase by the **net received**
+- pool liabilities increase by the **gross requested amount**
+
+So liabilities outrun assets by 2% of every deposit forever. Early unstakers succeed because there is still enough real token balance in the contract. Later unstakers revert because earlier withdrawals consumed the real tokens while the remaining users still hold overstated balances on paper.
+
+This is why “the books do not close.”
+
+## Correct fix
+
+The accounting must use the **actual balance delta**, not the requested `amount`.
+
+```solidity
+function stake(uint256 amount) external {
+    uint256 beforeBal = token.balanceOf(address(this));
+    token.transferFrom(msg.sender, address(this), amount);
+    uint256 received = token.balanceOf(address(this)) - beforeBal;
+
+    stakedBalance[msg.sender] += received;
+}
+```
+
+Using `SafeERC20` is also advisable, but the key fix is: **credit only what the contract actually received**.
+
+If the token is also fee-on-transfer on withdrawals, then a user who unstakes `X` will still only receive the token’s net-after-fee amount in their wallet. That is a token property, not a pool accounting error, as long as the pool reduces balances by what leaves the pool.
+
+## What happens to users who currently cannot unstake
+
+Changing the code fixes future accounting, but it does **not** repair the existing `25,000 TKN` hole.
+
+Right now, current stakers are collectively owed `1,000,000 TKN` by the contract’s internal ledger, but the pool only holds `975,000 TKN`. So some users are already undercollateralized.
+
+That means one of these must happen:
+
+1. The operator recapitalizes the pool with `25,000 TKN`, letting current recorded balances be honored in full.
+2. The recorded balances are written down to match reality, which socializes the loss across current stakers.
+
+Without adding `25,000 TKN`, it is mathematically impossible for every current staker to withdraw their recorded balance, because those tokens were never in the pool in the first place.

codex
The write-up is in place. I’m doing a quick pass on `answer.md` to make sure the arithmetic and remediation section are internally consistent before I close out.
exec
/bin/bash -lc "sed -n '1,240p' answer.md" in /tmp/ethskills-security-eval/2026-08-31T211549Z-codex-with-skill-2/security-quiz-003
 succeeded in 11ms:
The missing `25,000 TKN` was lost on **stake deposits**, not on withdrawals.

## What happened

The pool assumes that if a user calls `stake(amount)`, then the pool receives exactly `amount` tokens:

```solidity
token.transferFrom(msg.sender, address(this), amount);
stakedBalance[msg.sender] += amount;
```

That assumption is false for a fee-on-transfer token.

The user example proves `TKN` charges a 2% transfer fee:

- user unstaked `10,000`
- pool sent `10,000`
- wallet received `9,800`

So when someone stakes `10,000`, the same thing happens in reverse:

- user sends `10,000`
- pool receives only `9,800`
- contract still credits `stakedBalance[user] += 10,000`

That creates an immediate `200 TKN` accounting hole.

## Why the numbers match exactly

Cumulative stake calls: `1,250,000 TKN`

If `TKN` takes 2% on each inbound transfer, the pool actually received:

`1,250,000 * 98% = 1,225,000 TKN`

But the contract credited users for the full `1,250,000 TKN`.

So the books were overstated by:

`1,250,000 - 1,225,000 = 25,000 TKN`

That is exactly the observed shortfall:

- recorded current stakes: `1,000,000 TKN`
- actual pool balance: `975,000 TKN`
- deficit: `25,000 TKN`

The withdrawal side explains the user complaint, but not the `25,000` mismatch:

- when the pool transfers `amount` out, its balance drops by `amount`
- the user receives less because the token taxes the transfer

So withdrawals are painful for users, but they do **not** create this specific asset-vs-liability gap. The gap was created when deposits were credited at gross amount instead of net received.

## Why the shortfall grows

It grows on every new stake.

Each time a user stakes:

- pool assets increase by the **net received**
- pool liabilities increase by the **gross requested amount**

So liabilities outrun assets by 2% of every deposit forever. Early unstakers succeed because there is still enough real token balance in the contract. Later unstakers revert because earlier withdrawals consumed the real tokens while the remaining users still hold overstated balances on paper.

This is why “the books do not close.”

## Correct fix

The accounting must use the **actual balance delta**, not the requested `amount`.

```solidity
function stake(uint256 amount) external {
    uint256 beforeBal = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - beforeBal;

    stakedBalance[msg.sender] += received;
}
```

Using `SafeERC20` is also advisable, but the key fix is: **credit only what the contract actually received**.

If the token is also fee-on-transfer on withdrawals, then a user who unstakes `X` will still only receive the token’s net-after-fee amount in their wallet. That is a token property, not a pool accounting error, as long as the pool reduces balances by what leaves the pool.

## What happens to users who currently cannot unstake

Changing the code fixes future accounting, but it does **not** repair the existing `25,000 TKN` hole.

Right now, current stakers are collectively owed `1,000,000 TKN` by the contract’s internal ledger, but the pool only holds `975,000 TKN`. So some users are already undercollateralized.

That means one of these must happen:

1. The operator recapitalizes the pool with `25,000 TKN`, letting current recorded balances be honored in full.
2. The recorded balances are written down to match reality, which socializes the loss across current stakers.

Without adding `25,000 TKN`, it is mathematically impossible for every current staker to withdraw their recorded balance, because those tokens were never in the pool in the first place.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..59dc691e227b0c1c44e3ae319f063417180e282f
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,97 @@
+The missing `25,000 TKN` was lost on **stake deposits**, not on withdrawals.
+
+## What happened
+
+The pool assumes that if a user calls `stake(amount)`, then the pool receives exactly `amount` tokens:
+
+```solidity
+token.transferFrom(msg.sender, address(this), amount);
+stakedBalance[msg.sender] += amount;
+```
+
+That assumption is false for a fee-on-transfer token.
+
+The user example proves `TKN` charges a 2% transfer fee:
+
+- user unstaked `10,000`
+- pool sent `10,000`
+- wallet received `9,800`
+
+So when someone stakes `10,000`, the same thing happens in reverse:
+
+- user sends `10,000`
+- pool receives only `9,800`
+- contract still credits `stakedBalance[user] += 10,000`
+
+That creates an immediate `200 TKN` accounting hole.
+
+## Why the numbers match exactly
+
+Cumulative stake calls: `1,250,000 TKN`
+
+If `TKN` takes 2% on each inbound transfer, the pool actually received:
+
+`1,250,000 * 98% = 1,225,000 TKN`
+
+But the contract credited users for the full `1,250,000 TKN`.
+
+So the books were overstated by:
+
+`1,250,000 - 1,225,000 = 25,000 TKN`
+
+That is exactly the observed shortfall:
+
+- recorded current stakes: `1,000,000 TKN`
+- actual pool balance: `975,000 TKN`
+- deficit: `25,000 TKN`
+
+The withdrawal side explains the user complaint, but not the `25,000` mismatch:
+
+- when the pool transfers `amount` out, its balance drops by `amount`
+- the user receives less because the token taxes the transfer
+
+So withdrawals are painful for users, but they do **not** create this specific asset-vs-liability gap. The gap was created when deposits were credited at gross amount instead of net received.
+
+## Why the shortfall grows
+
+It grows on every new stake.
+
+Each time a user stakes:
+
+- pool assets increase by the **net received**
+- pool liabilities increase by the **gross requested amount**
+
+So liabilities outrun assets by 2% of every deposit forever. Early unstakers succeed because there is still enough real token balance in the contract. Later unstakers revert because earlier withdrawals consumed the real tokens while the remaining users still hold overstated balances on paper.
+
+This is why “the books do not close.”
+
+## Correct fix
+
+The accounting must use the **actual balance delta**, not the requested `amount`.
+
+```solidity
+function stake(uint256 amount) external {
+    uint256 beforeBal = token.balanceOf(address(this));
+    token.transferFrom(msg.sender, address(this), amount);
+    uint256 received = token.balanceOf(address(this)) - beforeBal;
+
+    stakedBalance[msg.sender] += received;
+}
+```
+
+Using `SafeERC20` is also advisable, but the key fix is: **credit only what the contract actually received**.
+
+If the token is also fee-on-transfer on withdrawals, then a user who unstakes `X` will still only receive the token’s net-after-fee amount in their wallet. That is a token property, not a pool accounting error, as long as the pool reduces balances by what leaves the pool.
+
+## What happens to users who currently cannot unstake
+
+Changing the code fixes future accounting, but it does **not** repair the existing `25,000 TKN` hole.
+
+Right now, current stakers are collectively owed `1,000,000 TKN` by the contract’s internal ledger, but the pool only holds `975,000 TKN`. So some users are already undercollateralized.
+
+That means one of these must happen:
+
+1. The operator recapitalizes the pool with `25,000 TKN`, letting current recorded balances be honored in full.
+2. The recorded balances are written down to match reality, which socializes the loss across current stakers.
+
+Without adding `25,000 TKN`, it is mathematically impossible for every current staker to withdraw their recorded balance, because those tokens were never in the pool in the first place.

codex
Wrote the explanation to [answer.md](/tmp/ethskills-security-eval/2026-08-31T211549Z-codex-with-skill-2/security-quiz-003/answer.md).

It identifies the root cause as fee-on-transfer deposit accounting: the pool credits `amount` on stake even though it only receives 98% of `amount`, which explains the exact `25,000 TKN` deficit from `1,250,000 TKN` cumulative deposits. It also explains why the deficit grows over time and why some current unstakers now revert.

The fix in the write-up is to credit `stakedBalance` by the contract’s actual balance delta on `stake()`, not by the requested input amount. It also notes that the existing `25,000 TKN` hole cannot be fixed by code alone: either the pool must be topped up, or current balances must be written down.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..59dc691e227b0c1c44e3ae319f063417180e282f
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,97 @@
+The missing `25,000 TKN` was lost on **stake deposits**, not on withdrawals.
+
+## What happened
+
+The pool assumes that if a user calls `stake(amount)`, then the pool receives exactly `amount` tokens:
+
+```solidity
+token.transferFrom(msg.sender, address(this), amount);
+stakedBalance[msg.sender] += amount;
+```
+
+That assumption is false for a fee-on-transfer token.
+
+The user example proves `TKN` charges a 2% transfer fee:
+
+- user unstaked `10,000`
+- pool sent `10,000`
+- wallet received `9,800`
+
+So when someone stakes `10,000`, the same thing happens in reverse:
+
+- user sends `10,000`
+- pool receives only `9,800`
+- contract still credits `stakedBalance[user] += 10,000`
+
+That creates an immediate `200 TKN` accounting hole.
+
+## Why the numbers match exactly
+
+Cumulative stake calls: `1,250,000 TKN`
+
+If `TKN` takes 2% on each inbound transfer, the pool actually received:
+
+`1,250,000 * 98% = 1,225,000 TKN`
+
+But the contract credited users for the full `1,250,000 TKN`.
+
+So the books were overstated by:
+
+`1,250,000 - 1,225,000 = 25,000 TKN`
+
+That is exactly the observed shortfall:
+
+- recorded current stakes: `1,000,000 TKN`
+- actual pool balance: `975,000 TKN`
+- deficit: `25,000 TKN`
+
+The withdrawal side explains the user complaint, but not the `25,000` mismatch:
+
+- when the pool transfers `amount` out, its balance drops by `amount`
+- the user receives less because the token taxes the transfer
+
+So withdrawals are painful for users, but they do **not** create this specific asset-vs-liability gap. The gap was created when deposits were credited at gross amount instead of net received.
+
+## Why the shortfall grows
+
+It grows on every new stake.
+
+Each time a user stakes:
+
+- pool assets increase by the **net received**
+- pool liabilities increase by the **gross requested amount**
+
+So liabilities outrun assets by 2% of every deposit forever. Early unstakers succeed because there is still enough real token balance in the contract. Later unstakers revert because earlier withdrawals consumed the real tokens while the remaining users still hold overstated balances on paper.
+
+This is why “the books do not close.”
+
+## Correct fix
+
+The accounting must use the **actual balance delta**, not the requested `amount`.
+
+```solidity
+function stake(uint256 amount) external {
+    uint256 beforeBal = token.balanceOf(address(this));
+    token.transferFrom(msg.sender, address(this), amount);
+    uint256 received = token.balanceOf(address(this)) - beforeBal;
+
+    stakedBalance[msg.sender] += received;
+}
+```
+
+Using `SafeERC20` is also advisable, but the key fix is: **credit only what the contract actually received**.
+
+If the token is also fee-on-transfer on withdrawals, then a user who unstakes `X` will still only receive the token’s net-after-fee amount in their wallet. That is a token property, not a pool accounting error, as long as the pool reduces balances by what leaves the pool.
+
+## What happens to users who currently cannot unstake
+
+Changing the code fixes future accounting, but it does **not** repair the existing `25,000 TKN` hole.
+
+Right now, current stakers are collectively owed `1,000,000 TKN` by the contract’s internal ledger, but the pool only holds `975,000 TKN`. So some users are already undercollateralized.
+
+That means one of these must happen:
+
+1. The operator recapitalizes the pool with `25,000 TKN`, letting current recorded balances be honored in full.
+2. The recorded balances are written down to match reality, which socializes the loss across current stakers.
+
+Without adding `25,000 TKN`, it is mathematically impossible for every current staker to withdraw their recorded balance, because those tokens were never in the pool in the first place.

tokens used
13,602
````

## final message

Wrote the explanation to [answer.md](/tmp/ethskills-security-eval/2026-08-31T211549Z-codex-with-skill-2/security-quiz-003/answer.md).

It identifies the root cause as fee-on-transfer deposit accounting: the pool credits `amount` on stake even though it only receives 98% of `amount`, which explains the exact `25,000 TKN` deficit from `1,250,000 TKN` cumulative deposits. It also explains why the deficit grows over time and why some current unstakers now revert.

The fix in the write-up is to credit `stakedBalance` by the contract’s actual balance delta on `stake()`, not by the requested input amount. It also notes that the existing `25,000 TKN` hole cannot be fixed by code alone: either the pool must be topped up, or current balances must be written down.
