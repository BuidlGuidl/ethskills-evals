# Executor transcript — 2026-09-04T125934Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-04T125934Z-codex-with-skill-2/security-quiz-004

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-04T125934Z-codex-with-skill-2/security-quiz-004
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06c8b-ab1d-7971-92f4-f41ad57a9fe5
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

codex
I’m using the `security` skill here because this is an ERC-20 approval behavior issue with treasury custody. First I’ll read the skill instructions, then I’ll write the answer into `answer.md` with the reasoning spelled out.
exec
/bin/bash -lc "sed -n '1,220p' .agents/skills/security/SKILL.md" in /home/damu/.cache/ethskills-evals/2026-09-04T125934Z-codex-with-skill-2/security-quiz-004
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
---
name: security
description: Use when designing, implementing, or reviewing Solidity contracts that custody assets, account for shares or debt, consume price oracles, verify signatures, integrate ERC-20s, or use upgradeable proxies; also use for a pre-deployment security review. Not for test-suite design (`testing`) or a full multi-domain audit (`audit`).
---

# Smart Contract Security

Treat every external token, price, signature, callback, and privileged caller as adversarial. Prefer audited OpenZeppelin primitives over hand-rolled implementations, but verify the installed library version and the assumptions around each primitive.

## Asset accounting

- Keep units explicit. ERC-20 decimals and oracle decimals vary; normalize every quantity to one documented scale before comparing collateral, debt, fees, or shares. Multiply before dividing and use full-precision `mulDiv` where intermediate overflow or rounding matters.
- For arbitrary ERC-20s, use `SafeERC20.safeTransfer` and `safeTransferFrom`. Credit deposits from the contract's balance delta, not the requested amount, or reject tokens whose received amount differs. Fee-on-transfer and rebasing tokens otherwise break custody accounting.
- On OpenZeppelin Contracts v5, use `SafeERC20.forceApprove` when an allowance may already be nonzero. `safeApprove` was removed. Keep approvals exact or bounded and clear leftovers when practical.
- Apply checks-effects-interactions and a reentrancy guard to value-moving entry points. Update shares, debt, and other accounting before external calls.

For a vault or receipt-token design, start from OpenZeppelin `ERC4626`. A hand-rolled vault must defend its empty state against first-depositor donation/inflation attacks with virtual assets and shares or another explicit mitigation. Test direct donations and rounding at small deposits; never use an unprotected `assets * totalSupply / totalAssets` conversion with a special 1:1 empty-vault path.

## Prices and liquidations

Never use a DEX spot read (`slot0`, reserves, balances, or a current quote) for collateral, borrowing, minting, or liquidation decisions. Pool depth does not fix atomic manipulation: flash-borrowed capital can move the price, exploit the dependent action, unwind, and repay inside one transaction before arbitrage can intervene.

Use a manipulation-resistant push feed for high-value decisions, or a meaningful TWAP when its weaker guarantees fit the risk. For every feed:

- require a positive answer;
- validate `updatedAt` against a per-feed maximum age derived from that feed's published heartbeat plus a justified margin—never one global hardcoded timeout;
- handle feed and token decimals explicitly;
- define behavior for sequencer downtime where relevant; and
- bound liquidation incentives and any swap's minimum output.

## Signatures and replay protection

Use EIP-712 and OpenZeppelin's implementation rather than assembling signature recovery from scratch. Bind the signed action to the intended contract and chain, consume a signer-scoped nonce, enforce a deadline, and update replay state before moving assets.

If a domain separator is cached, also cache the deployment chain id and re-derive the separator whenever `block.chainid` differs. An immutable separator computed only at deployment becomes stale after a fork. OpenZeppelin `EIP712` handles this invalidation.

## Upgradeability and authority

Use an upgradeable design only when post-deployment changes are required. With proxies:

- initialize through an initializer and disable initializers on the implementation;
- use the upgradeable variants of inherited contracts;
- preserve inheritance order and storage layout—append variables only; never insert, delete, reorder, or change an existing type;
- run the framework's storage-layout compatibility check before every upgrade; and
- put upgrade and emergency authority behind the intended multisig or timelock, not a single EOA.

Every privileged state change needs explicit access control. Make pause, upgrade, rescue, oracle-update, and parameter-update powers visible in the threat model; a safety switch controlled by one key is also a censorship and compromise risk. Never `delegatecall` to a user-selected target.

## Before deployment

- Trace assets, shares, debt, approvals, callbacks, and privilege through every success and failure path.
- Test zero, maximum, rounding, donation, fee-on-transfer, stale-price, replay, reentrancy, and unauthorized-caller cases that apply.
- Run unit, fuzz, invariant, and pinned-fork tests appropriate to the integrations; use the `testing` skill for suite design.
- Run static analysis and resolve every high or medium finding or document why it is a false positive.
- Verify deployed bytecode and transfer production authority to the intended multisig or timelock.
- For a comprehensive pre-deployment review across domains, use the `audit` skill.

codex
I’ve confirmed the failure mode: this is USDT’s zero-first approval rule, not a generic low-level call issue. I’m writing the answer now and I’ll make the fix recommendation match OpenZeppelin v5.
exec
/bin/bash -lc 'ls -1' in /home/damu/.cache/ethskills-evals/2026-09-04T125934Z-codex-with-skill-2/security-quiz-004
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
TASK.md
package.json

codex
I’m editing `answer.md` directly now. The answer will explain why the first USDT run passed, why later ones fail, and the smallest safe router change.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T125934Z-codex-with-skill-2/security-quiz-004/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..3e1c15b7a6aff73f9cc70542118fca2dfef4a54b
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,53 @@
+The failure is USDT-specific because USDT does not behave like a normal ERC-20 for
+`approve`.
+
+Reasoning:
+
+1. The router currently does a raw call to `approve(strategy, amount)` and only
+   checks whether the call reverted:
+
+   ```solidity
+   (bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
+   require(ok, "approve failed");
+   ```
+
+2. USDC allows changing allowance from one nonzero value to another nonzero
+   value, so repeated runs succeed.
+
+3. USDT uses the older "zero-first" approval rule: if the current allowance is
+   nonzero, setting it to another nonzero value reverts. The first run worked
+   because the initial allowance was `0`. After that, the strategy often spent
+   less than approved, so a leftover nonzero allowance remained. On the next
+   run, the router attempted a nonzero-to-nonzero `approve`, and USDT reverted.
+   Your low-level call avoided return-data decoding issues, but it did not avoid
+   the token's actual approval rule, so `ok == false` and the router hit
+   `require(ok, "approve failed")`.
+
+Minimal fix:
+
+Since the repo is on OpenZeppelin Contracts v5, replace the raw `approve` call
+with `SafeERC20.forceApprove`, which handles zero-first tokens like USDT.
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+`forceApprove` will set the allowance directly when possible, and for tokens
+like USDT it will fall back to:
+
+1. `approve(strategy, 0)`
+2. `approve(strategy, amount)`
+
+That is the minimal router change that fixes the issue.
+
+What to do about leftover allowance in general:
+
+- Do not assume you can overwrite a leftover nonzero allowance.
+- Keep approvals exact or tightly bounded.
+- When practical, clear leftover allowance back to zero after the strategy has
+  finished, especially if approvals are only meant for a single run.
+
+In short: the router should treat leftover allowance as state that must be
+explicitly handled. On OZ v5, `forceApprove` is the correct primitive for that.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..3e1c15b7a6aff73f9cc70542118fca2dfef4a54b
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,53 @@
+The failure is USDT-specific because USDT does not behave like a normal ERC-20 for
+`approve`.
+
+Reasoning:
+
+1. The router currently does a raw call to `approve(strategy, amount)` and only
+   checks whether the call reverted:
+
+   ```solidity
+   (bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
+   require(ok, "approve failed");
+   ```
+
+2. USDC allows changing allowance from one nonzero value to another nonzero
+   value, so repeated runs succeed.
+
+3. USDT uses the older "zero-first" approval rule: if the current allowance is
+   nonzero, setting it to another nonzero value reverts. The first run worked
+   because the initial allowance was `0`. After that, the strategy often spent
+   less than approved, so a leftover nonzero allowance remained. On the next
+   run, the router attempted a nonzero-to-nonzero `approve`, and USDT reverted.
+   Your low-level call avoided return-data decoding issues, but it did not avoid
+   the token's actual approval rule, so `ok == false` and the router hit
+   `require(ok, "approve failed")`.
+
+Minimal fix:
+
+Since the repo is on OpenZeppelin Contracts v5, replace the raw `approve` call
+with `SafeERC20.forceApprove`, which handles zero-first tokens like USDT.
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+`forceApprove` will set the allowance directly when possible, and for tokens
+like USDT it will fall back to:
+
+1. `approve(strategy, 0)`
+2. `approve(strategy, amount)`
+
+That is the minimal router change that fixes the issue.
+
+What to do about leftover allowance in general:
+
+- Do not assume you can overwrite a leftover nonzero allowance.
+- Keep approvals exact or tightly bounded.
+- When practical, clear leftover allowance back to zero after the strategy has
+  finished, especially if approvals are only meant for a single run.
+
+In short: the router should treat leftover allowance as state that must be
+explicitly handled. On OZ v5, `forceApprove` is the correct primitive for that.

codex
The answer file is in place. I’m doing a quick verification pass to ensure it states the exact failure mode and the OZ v5-specific fix cleanly.
exec
/bin/bash -lc "sed -n '1,240p' answer.md" in /home/damu/.cache/ethskills-evals/2026-09-04T125934Z-codex-with-skill-2/security-quiz-004
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
The failure is USDT-specific because USDT does not behave like a normal ERC-20 for
`approve`.

Reasoning:

1. The router currently does a raw call to `approve(strategy, amount)` and only
   checks whether the call reverted:

   ```solidity
   (bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
   require(ok, "approve failed");
   ```

2. USDC allows changing allowance from one nonzero value to another nonzero
   value, so repeated runs succeed.

3. USDT uses the older "zero-first" approval rule: if the current allowance is
   nonzero, setting it to another nonzero value reverts. The first run worked
   because the initial allowance was `0`. After that, the strategy often spent
   less than approved, so a leftover nonzero allowance remained. On the next
   run, the router attempted a nonzero-to-nonzero `approve`, and USDT reverted.
   Your low-level call avoided return-data decoding issues, but it did not avoid
   the token's actual approval rule, so `ok == false` and the router hit
   `require(ok, "approve failed")`.

Minimal fix:

Since the repo is on OpenZeppelin Contracts v5, replace the raw `approve` call
with `SafeERC20.forceApprove`, which handles zero-first tokens like USDT.

```solidity
using SafeERC20 for IERC20;

IERC20(token).forceApprove(strategy, amount);
```

`forceApprove` will set the allowance directly when possible, and for tokens
like USDT it will fall back to:

1. `approve(strategy, 0)`
2. `approve(strategy, amount)`

That is the minimal router change that fixes the issue.

What to do about leftover allowance in general:

- Do not assume you can overwrite a leftover nonzero allowance.
- Keep approvals exact or tightly bounded.
- When practical, clear leftover allowance back to zero after the strategy has
  finished, especially if approvals are only meant for a single run.

In short: the router should treat leftover allowance as state that must be
explicitly handled. On OZ v5, `forceApprove` is the correct primitive for that.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..3e1c15b7a6aff73f9cc70542118fca2dfef4a54b
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,53 @@
+The failure is USDT-specific because USDT does not behave like a normal ERC-20 for
+`approve`.
+
+Reasoning:
+
+1. The router currently does a raw call to `approve(strategy, amount)` and only
+   checks whether the call reverted:
+
+   ```solidity
+   (bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
+   require(ok, "approve failed");
+   ```
+
+2. USDC allows changing allowance from one nonzero value to another nonzero
+   value, so repeated runs succeed.
+
+3. USDT uses the older "zero-first" approval rule: if the current allowance is
+   nonzero, setting it to another nonzero value reverts. The first run worked
+   because the initial allowance was `0`. After that, the strategy often spent
+   less than approved, so a leftover nonzero allowance remained. On the next
+   run, the router attempted a nonzero-to-nonzero `approve`, and USDT reverted.
+   Your low-level call avoided return-data decoding issues, but it did not avoid
+   the token's actual approval rule, so `ok == false` and the router hit
+   `require(ok, "approve failed")`.
+
+Minimal fix:
+
+Since the repo is on OpenZeppelin Contracts v5, replace the raw `approve` call
+with `SafeERC20.forceApprove`, which handles zero-first tokens like USDT.
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+`forceApprove` will set the allowance directly when possible, and for tokens
+like USDT it will fall back to:
+
+1. `approve(strategy, 0)`
+2. `approve(strategy, amount)`
+
+That is the minimal router change that fixes the issue.
+
+What to do about leftover allowance in general:
+
+- Do not assume you can overwrite a leftover nonzero allowance.
+- Keep approvals exact or tightly bounded.
+- When practical, clear leftover allowance back to zero after the strategy has
+  finished, especially if approvals are only meant for a single run.
+
+In short: the router should treat leftover allowance as state that must be
+explicitly handled. On OZ v5, `forceApprove` is the correct primitive for that.

codex
Wrote the answer to [answer.md](/home/damu/.cache/ethskills-evals/2026-09-04T125934Z-codex-with-skill-2/security-quiz-004/answer.md).

Core point: USDT requires a zero-first allowance change, so the first run succeeded from `0`, and later runs failed because leftover nonzero allowance made `approve(nonzero)` revert. The minimal OZ v5 fix is to replace the raw low-level approval with `IERC20(token).forceApprove(strategy, amount)`.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..3e1c15b7a6aff73f9cc70542118fca2dfef4a54b
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,53 @@
+The failure is USDT-specific because USDT does not behave like a normal ERC-20 for
+`approve`.
+
+Reasoning:
+
+1. The router currently does a raw call to `approve(strategy, amount)` and only
+   checks whether the call reverted:
+
+   ```solidity
+   (bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
+   require(ok, "approve failed");
+   ```
+
+2. USDC allows changing allowance from one nonzero value to another nonzero
+   value, so repeated runs succeed.
+
+3. USDT uses the older "zero-first" approval rule: if the current allowance is
+   nonzero, setting it to another nonzero value reverts. The first run worked
+   because the initial allowance was `0`. After that, the strategy often spent
+   less than approved, so a leftover nonzero allowance remained. On the next
+   run, the router attempted a nonzero-to-nonzero `approve`, and USDT reverted.
+   Your low-level call avoided return-data decoding issues, but it did not avoid
+   the token's actual approval rule, so `ok == false` and the router hit
+   `require(ok, "approve failed")`.
+
+Minimal fix:
+
+Since the repo is on OpenZeppelin Contracts v5, replace the raw `approve` call
+with `SafeERC20.forceApprove`, which handles zero-first tokens like USDT.
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+`forceApprove` will set the allowance directly when possible, and for tokens
+like USDT it will fall back to:
+
+1. `approve(strategy, 0)`
+2. `approve(strategy, amount)`
+
+That is the minimal router change that fixes the issue.
+
+What to do about leftover allowance in general:
+
+- Do not assume you can overwrite a leftover nonzero allowance.
+- Keep approvals exact or tightly bounded.
+- When practical, clear leftover allowance back to zero after the strategy has
+  finished, especially if approvals are only meant for a single run.
+
+In short: the router should treat leftover allowance as state that must be
+explicitly handled. On OZ v5, `forceApprove` is the correct primitive for that.

tokens used
10,858
````

## final message

Wrote the answer to [answer.md](/home/damu/.cache/ethskills-evals/2026-09-04T125934Z-codex-with-skill-2/security-quiz-004/answer.md).

Core point: USDT requires a zero-first allowance change, so the first run succeeded from `0`, and later runs failed because leftover nonzero allowance made `approve(nonzero)` revert. The minimal OZ v5 fix is to replace the raw low-level approval with `IERC20(token).forceApprove(strategy, amount)`.
