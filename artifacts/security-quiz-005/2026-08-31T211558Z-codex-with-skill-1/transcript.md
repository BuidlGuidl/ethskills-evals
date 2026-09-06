# Executor transcript — 2026-08-31T211558Z-codex-with-skill-1

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /tmp/ethskills-security-eval/2026-08-31T211558Z-codex-with-skill-1/security-quiz-005

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-security-eval/2026-08-31T211558Z-codex-with-skill-1/security-quiz-005
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a059c1-6485-7183-b0dc-a241fda49115
--------
user
Post-mortem needed on our gasless order relayer. Users sign an order
off-chain — (owner, token, amount, nonce, deadline) — and our relayer submits
it on their behalf; the contract recovers the signer, checks the nonce has
not been used, checks the deadline, marks the nonce used and moves the tokens.

We ship the same contract to every chain we support and deploy it with
CREATE2 from the same factory and salt, so it sits at the identical address
on Ethereum mainnet, Base and Arbitrum. Users like that: one address to
remember.

What happened: a user signed one order for 5,000 USDC. Our relayer executed
it on Base at 14:02 — correct, that was the order. At 14:07 someone else
submitted the exact same signature to the mainnet deployment and it executed
there too, moving another 5,000 USDC of the user's mainnet balance. The user
signed once. They were charged twice.

Both executions passed every check the contract makes. On mainnet the
recovered signer was the owner, the nonce had never been used, and the
deadline had not passed.

How we build the digest: `keccak256(abi.encodePacked("\x19\x01",
DOMAIN_SEPARATOR, structHash))`, where DOMAIN_SEPARATOR is computed once in
the constructor from the contract name, a version string, and address(this),
and stored in an immutable.

Explain why the mainnet deployment accepted a signature the user produced for
Base, and what has to change so one signature can only ever be valid on the
chain it was meant for. We want to keep the same address on every chain.

Write your answer to answer.md in this directory, showing your reasoning.

2026-08-31T21:37:21.796876Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a059c1-6485-7183-b0dc-a241fda49115.tmp-1788212241555363709: line 2547: syntax error near unexpected token `('

codex
I’m reviewing the repo and the security skill first, then I’ll write the post-mortem analysis into `answer.md` with the chain-specific signature failure mode and fix.
exec
/bin/bash -lc "sed -n '1,220p' .agents/skills/security/SKILL.md" in /tmp/ethskills-security-eval/2026-08-31T211558Z-codex-with-skill-1/security-quiz-005
 succeeded in 13ms:
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
I’ve confirmed this is an EIP-712/domain-separation issue. I’m checking the local files now so the write-up matches the repo context before I create `answer.md`.
exec
/bin/bash -lc 'rg --files' in /tmp/ethskills-security-eval/2026-08-31T211558Z-codex-with-skill-1/security-quiz-005
exec
/bin/bash -lc 'git status --short' in /tmp/ethskills-security-eval/2026-08-31T211558Z-codex-with-skill-1/security-quiz-005
 succeeded in 36ms:
TASK.md
package.json

 succeeded in 43ms:
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /tmp/ethskills-security-eval/2026-08-31T211558Z-codex-with-skill-1/security-quiz-005
 succeeded in 23ms:
Post-mortem needed on our gasless order relayer. Users sign an order
off-chain — (owner, token, amount, nonce, deadline) — and our relayer submits
it on their behalf; the contract recovers the signer, checks the nonce has
not been used, checks the deadline, marks the nonce used and moves the tokens.

We ship the same contract to every chain we support and deploy it with
CREATE2 from the same factory and salt, so it sits at the identical address
on Ethereum mainnet, Base and Arbitrum. Users like that: one address to
remember.

What happened: a user signed one order for 5,000 USDC. Our relayer executed
it on Base at 14:02 — correct, that was the order. At 14:07 someone else
submitted the exact same signature to the mainnet deployment and it executed
there too, moving another 5,000 USDC of the user's mainnet balance. The user
signed once. They were charged twice.

Both executions passed every check the contract makes. On mainnet the
recovered signer was the owner, the nonce had never been used, and the
deadline had not passed.

How we build the digest: `keccak256(abi.encodePacked("\x19\x01",
DOMAIN_SEPARATOR, structHash))`, where DOMAIN_SEPARATOR is computed once in
the constructor from the contract name, a version string, and address(this),
and stored in an immutable.

Explain why the mainnet deployment accepted a signature the user produced for
Base, and what has to change so one signature can only ever be valid on the
chain it was meant for. We want to keep the same address on every chain.

Write your answer to answer.md in this directory, showing your reasoning.

codex
I’ve narrowed it down to the missing `chainId` in the signed domain. I’m writing the post-mortem now and will make the fix recommendation explicit about preserving the same contract address across chains.
apply patch
patch: completed
/tmp/ethskills-security-eval/2026-08-31T211558Z-codex-with-skill-1/security-quiz-005/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..c1ff85138d42134f547a8c88f47d19ae1803abad
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,125 @@
+The mainnet deployment accepted the Base signature because the signature was
+not bound to a specific chain.
+
+Reasoning:
+
+1. The signed payload is:
+
+```text
+keccak256("\x19\x01" || DOMAIN_SEPARATOR || structHash)
+```
+
+2. `structHash` only covers:
+
+```text
+(owner, token, amount, nonce, deadline)
+```
+
+There is no chain-specific field in that struct.
+
+3. Your `DOMAIN_SEPARATOR` is computed from:
+
+- contract name
+- version
+- `address(this)`
+
+There is also no chain-specific field there.
+
+4. Because you deploy the same contract with `CREATE2` from the same factory
+and salt, `address(this)` is the same on Base, Ethereum mainnet, and Arbitrum.
+If the name and version are also the same, then the `DOMAIN_SEPARATOR` is the
+same on every chain too.
+
+5. That means the full digest signed by the user on Base was bit-for-bit
+identical to the digest recovered on mainnet:
+
+```text
+digest_base == digest_mainnet
+```
+
+So `ecrecover` on mainnet returned the same signer, and the signature remained
+valid there.
+
+6. The nonce check did not stop this because your nonce tracking is local to
+each deployment. Using nonce `N` on Base only marks `used[owner][N]` in the
+Base contract storage. The mainnet contract has separate storage, so the same
+nonce was still unused there.
+
+7. The deadline check also passed because the copied signature was replayed
+before expiration.
+
+So the root cause is cross-chain replay: same signed digest, same contract
+address, separate per-chain nonce storage.
+
+What has to change:
+
+The signature must commit to the intended chain. The standard way is to make
+the EIP-712 domain include `chainId`.
+
+Use a domain of the form:
+
+```text
+EIP712Domain(
+    string name,
+    string version,
+    uint256 chainId,
+    address verifyingContract
+)
+```
+
+and compute the separator with the actual `block.chainid` for that deployment.
+
+Then:
+
+- Base signatures are bound to Base's chain ID
+- Mainnet signatures are bound to mainnet's chain ID
+- Arbitrum signatures are bound to Arbitrum's chain ID
+
+Even if `address(this)` is identical on every chain, the domain separator will
+be different because `chainId` differs. That makes the final digest different
+on each chain, so a signature produced for Base will fail recovery/validation
+on mainnet.
+
+In other words:
+
+```text
+digest_base != digest_mainnet
+```
+
+and the replay stops.
+
+Practical fix:
+
+- Add `chainId` to the domain separator.
+- Follow the standard EIP-712 domain type hash.
+- Derive it from `block.chainid`, not from a hardcoded value.
+
+Conceptually:
+
+```solidity
+DOMAIN_SEPARATOR = keccak256(
+    abi.encode(
+        keccak256(
+            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
+        ),
+        keccak256(bytes(name)),
+        keccak256(bytes(version)),
+        block.chainid,
+        address(this)
+    )
+);
+```
+
+You can keep the same contract address on every chain. Identical addresses are
+not the problem by themselves. The problem is that your signed domain omitted
+the chain identifier, so identical addresses made the domain collide across
+chains.
+
+Optional defense-in-depth:
+
+- Include `chainId` in the signed order struct as well, or
+- use OpenZeppelin's `EIP712` implementation, which handles proper domain
+  separation and chain ID behavior.
+
+But the essential fix is: bind the signature to the chain with `chainId` in
+the EIP-712 domain separator.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..c1ff85138d42134f547a8c88f47d19ae1803abad
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,125 @@
+The mainnet deployment accepted the Base signature because the signature was
+not bound to a specific chain.
+
+Reasoning:
+
+1. The signed payload is:
+
+```text
+keccak256("\x19\x01" || DOMAIN_SEPARATOR || structHash)
+```
+
+2. `structHash` only covers:
+
+```text
+(owner, token, amount, nonce, deadline)
+```
+
+There is no chain-specific field in that struct.
+
+3. Your `DOMAIN_SEPARATOR` is computed from:
+
+- contract name
+- version
+- `address(this)`
+
+There is also no chain-specific field there.
+
+4. Because you deploy the same contract with `CREATE2` from the same factory
+and salt, `address(this)` is the same on Base, Ethereum mainnet, and Arbitrum.
+If the name and version are also the same, then the `DOMAIN_SEPARATOR` is the
+same on every chain too.
+
+5. That means the full digest signed by the user on Base was bit-for-bit
+identical to the digest recovered on mainnet:
+
+```text
+digest_base == digest_mainnet
+```
+
+So `ecrecover` on mainnet returned the same signer, and the signature remained
+valid there.
+
+6. The nonce check did not stop this because your nonce tracking is local to
+each deployment. Using nonce `N` on Base only marks `used[owner][N]` in the
+Base contract storage. The mainnet contract has separate storage, so the same
+nonce was still unused there.
+
+7. The deadline check also passed because the copied signature was replayed
+before expiration.
+
+So the root cause is cross-chain replay: same signed digest, same contract
+address, separate per-chain nonce storage.
+
+What has to change:
+
+The signature must commit to the intended chain. The standard way is to make
+the EIP-712 domain include `chainId`.
+
+Use a domain of the form:
+
+```text
+EIP712Domain(
+    string name,
+    string version,
+    uint256 chainId,
+    address verifyingContract
+)
+```
+
+and compute the separator with the actual `block.chainid` for that deployment.
+
+Then:
+
+- Base signatures are bound to Base's chain ID
+- Mainnet signatures are bound to mainnet's chain ID
+- Arbitrum signatures are bound to Arbitrum's chain ID
+
+Even if `address(this)` is identical on every chain, the domain separator will
+be different because `chainId` differs. That makes the final digest different
+on each chain, so a signature produced for Base will fail recovery/validation
+on mainnet.
+
+In other words:
+
+```text
+digest_base != digest_mainnet
+```
+
+and the replay stops.
+
+Practical fix:
+
+- Add `chainId` to the domain separator.
+- Follow the standard EIP-712 domain type hash.
+- Derive it from `block.chainid`, not from a hardcoded value.
+
+Conceptually:
+
+```solidity
+DOMAIN_SEPARATOR = keccak256(
+    abi.encode(
+        keccak256(
+            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
+        ),
+        keccak256(bytes(name)),
+        keccak256(bytes(version)),
+        block.chainid,
+        address(this)
+    )
+);
+```
+
+You can keep the same contract address on every chain. Identical addresses are
+not the problem by themselves. The problem is that your signed domain omitted
+the chain identifier, so identical addresses made the domain collide across
+chains.
+
+Optional defense-in-depth:
+
+- Include `chainId` in the signed order struct as well, or
+- use OpenZeppelin's `EIP712` implementation, which handles proper domain
+  separation and chain ID behavior.
+
+But the essential fix is: bind the signature to the chain with `chainId` in
+the EIP-712 domain separator.

codex
Wrote the post-mortem to [answer.md](/tmp/ethskills-security-eval/2026-08-31T211558Z-codex-with-skill-1/security-quiz-005/answer.md).

Core conclusion: the signature was replayable across chains because your domain separator omitted `chainId`. With the same `name`, `version`, and `address(this)` on Base and mainnet, the EIP-712 digest was identical on both chains, and nonce storage is separate per deployment. The fix is to include `uint256 chainId` in the EIP-712 domain so one signature is only valid on its intended chain while keeping the same contract address everywhere.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..c1ff85138d42134f547a8c88f47d19ae1803abad
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,125 @@
+The mainnet deployment accepted the Base signature because the signature was
+not bound to a specific chain.
+
+Reasoning:
+
+1. The signed payload is:
+
+```text
+keccak256("\x19\x01" || DOMAIN_SEPARATOR || structHash)
+```
+
+2. `structHash` only covers:
+
+```text
+(owner, token, amount, nonce, deadline)
+```
+
+There is no chain-specific field in that struct.
+
+3. Your `DOMAIN_SEPARATOR` is computed from:
+
+- contract name
+- version
+- `address(this)`
+
+There is also no chain-specific field there.
+
+4. Because you deploy the same contract with `CREATE2` from the same factory
+and salt, `address(this)` is the same on Base, Ethereum mainnet, and Arbitrum.
+If the name and version are also the same, then the `DOMAIN_SEPARATOR` is the
+same on every chain too.
+
+5. That means the full digest signed by the user on Base was bit-for-bit
+identical to the digest recovered on mainnet:
+
+```text
+digest_base == digest_mainnet
+```
+
+So `ecrecover` on mainnet returned the same signer, and the signature remained
+valid there.
+
+6. The nonce check did not stop this because your nonce tracking is local to
+each deployment. Using nonce `N` on Base only marks `used[owner][N]` in the
+Base contract storage. The mainnet contract has separate storage, so the same
+nonce was still unused there.
+
+7. The deadline check also passed because the copied signature was replayed
+before expiration.
+
+So the root cause is cross-chain replay: same signed digest, same contract
+address, separate per-chain nonce storage.
+
+What has to change:
+
+The signature must commit to the intended chain. The standard way is to make
+the EIP-712 domain include `chainId`.
+
+Use a domain of the form:
+
+```text
+EIP712Domain(
+    string name,
+    string version,
+    uint256 chainId,
+    address verifyingContract
+)
+```
+
+and compute the separator with the actual `block.chainid` for that deployment.
+
+Then:
+
+- Base signatures are bound to Base's chain ID
+- Mainnet signatures are bound to mainnet's chain ID
+- Arbitrum signatures are bound to Arbitrum's chain ID
+
+Even if `address(this)` is identical on every chain, the domain separator will
+be different because `chainId` differs. That makes the final digest different
+on each chain, so a signature produced for Base will fail recovery/validation
+on mainnet.
+
+In other words:
+
+```text
+digest_base != digest_mainnet
+```
+
+and the replay stops.
+
+Practical fix:
+
+- Add `chainId` to the domain separator.
+- Follow the standard EIP-712 domain type hash.
+- Derive it from `block.chainid`, not from a hardcoded value.
+
+Conceptually:
+
+```solidity
+DOMAIN_SEPARATOR = keccak256(
+    abi.encode(
+        keccak256(
+            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
+        ),
+        keccak256(bytes(name)),
+        keccak256(bytes(version)),
+        block.chainid,
+        address(this)
+    )
+);
+```
+
+You can keep the same contract address on every chain. Identical addresses are
+not the problem by themselves. The problem is that your signed domain omitted
+the chain identifier, so identical addresses made the domain collide across
+chains.
+
+Optional defense-in-depth:
+
+- Include `chainId` in the signed order struct as well, or
+- use OpenZeppelin's `EIP712` implementation, which handles proper domain
+  separation and chain ID behavior.
+
+But the essential fix is: bind the signature to the chain with `chainId` in
+the EIP-712 domain separator.

tokens used
11,855
````

## final message

Wrote the post-mortem to [answer.md](/tmp/ethskills-security-eval/2026-08-31T211558Z-codex-with-skill-1/security-quiz-005/answer.md).

Core conclusion: the signature was replayable across chains because your domain separator omitted `chainId`. With the same `name`, `version`, and `address(this)` on Base and mainnet, the EIP-712 digest was identical on both chains, and nonce storage is separate per deployment. The fix is to include `uint256 chainId` in the EIP-712 domain so one signature is only valid on its intended chain while keeping the same contract address everywhere.
