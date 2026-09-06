# Executor transcript — 2026-09-04T125935Z-codex-with-skill-3

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-04T125935Z-codex-with-skill-3/security-quiz-004

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-04T125935Z-codex-with-skill-3/security-quiz-004
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06c8b-d795-7cc0-a23f-fbf28297e1bd
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
I’m reviewing the repo and the security guidance first, then I’ll write a concise root-cause analysis and fix into `answer.md`.
exec
/bin/bash -lc "printf '=== repo ===\\n'; rg --files ." in /home/damu/.cache/ethskills-evals/2026-09-04T125935Z-codex-with-skill-3/security-quiz-004
 succeeded in 1ms:
exec
/bin/bash -lc "sed -n '1,240p' /home/damu/.cache/ethskills-evals/2026-09-04T125935Z-codex-with-skill-3/security-quiz-004/.agents/skills/security/SKILL.md" in /home/damu/.cache/ethskills-evals/2026-09-04T125935Z-codex-with-skill-3/security-quiz-004
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
I’ve confirmed the relevant security guidance: with OZ v5, the approval path needs to handle tokens that reject nonzero-to-nonzero allowance changes. I’m checking the task file for any answer-format constraints, then I’ll write the answer.
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /home/damu/.cache/ethskills-evals/2026-09-04T125935Z-codex-with-skill-3/security-quiz-004
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
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
I have enough context. I’m writing `answer.md` with the root cause, the minimal router change, and the allowance-handling guidance tied to OZ v5/USDT behavior.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T125935Z-codex-with-skill-3/security-quiz-004/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..e0063c9584a82105965f0614fac0ccaa6c4f289b
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,29 @@
+USDT is the outlier because its `approve` implementation enforces the old "set to zero before changing to another nonzero allowance" rule. In practice:
+
+1. The first run succeeds because the router starts with `allowance(router, strategy) == 0`, so `approve(strategy, amount)` is a zero-to-nonzero change.
+2. The strategy then spends only part of that allowance, so some nonzero allowance remains.
+3. On the next run, the router again does `approve(strategy, amount)` while the current allowance is still nonzero.
+4. USDT rejects that nonzero-to-nonzero allowance update, so the low-level `call` returns `ok == false` and the router reverts at `require(ok, "approve failed")`.
+
+USDC does not enforce that rule, so repeated nonzero-to-nonzero approvals keep succeeding there.
+
+The minimal fix is to replace the raw low-level approve call with OpenZeppelin v5's `SafeERC20.forceApprove`, which handles this token class by zeroing first when needed.
+
+Example:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+`forceApprove` is the right OZ v5 primitive here specifically because `safeApprove` was removed and this exact compatibility issue is why `forceApprove` exists.
+
+About leftover allowance in general: the router should not assume the previous allowance is harmless. If the strategy only partially spends approval, that residual allowance remains live and can interfere with later approval flows on tokens like USDT. More importantly, leftover allowance is standing authorization, so it should be minimized.
+
+The general policy should be:
+
+- approve only the amount needed for the current run; and
+- clear any leftover allowance back to zero when practical after the strategy pull/spend is done, especially if approvals are not intended to stay open.
+
+If the router must support arbitrary ERC-20s and repeated runs, `forceApprove` is the minimal compatibility fix, and zeroing residual allowance after use is the safer allowance hygiene.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..e0063c9584a82105965f0614fac0ccaa6c4f289b
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,29 @@
+USDT is the outlier because its `approve` implementation enforces the old "set to zero before changing to another nonzero allowance" rule. In practice:
+
+1. The first run succeeds because the router starts with `allowance(router, strategy) == 0`, so `approve(strategy, amount)` is a zero-to-nonzero change.
+2. The strategy then spends only part of that allowance, so some nonzero allowance remains.
+3. On the next run, the router again does `approve(strategy, amount)` while the current allowance is still nonzero.
+4. USDT rejects that nonzero-to-nonzero allowance update, so the low-level `call` returns `ok == false` and the router reverts at `require(ok, "approve failed")`.
+
+USDC does not enforce that rule, so repeated nonzero-to-nonzero approvals keep succeeding there.
+
+The minimal fix is to replace the raw low-level approve call with OpenZeppelin v5's `SafeERC20.forceApprove`, which handles this token class by zeroing first when needed.
+
+Example:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+`forceApprove` is the right OZ v5 primitive here specifically because `safeApprove` was removed and this exact compatibility issue is why `forceApprove` exists.
+
+About leftover allowance in general: the router should not assume the previous allowance is harmless. If the strategy only partially spends approval, that residual allowance remains live and can interfere with later approval flows on tokens like USDT. More importantly, leftover allowance is standing authorization, so it should be minimized.
+
+The general policy should be:
+
+- approve only the amount needed for the current run; and
+- clear any leftover allowance back to zero when practical after the strategy pull/spend is done, especially if approvals are not intended to stay open.
+
+If the router must support arbitrary ERC-20s and repeated runs, `forceApprove` is the minimal compatibility fix, and zeroing residual allowance after use is the safer allowance hygiene.

codex
Wrote the answer to [answer.md](/home/damu/.cache/ethskills-evals/2026-09-04T125935Z-codex-with-skill-3/security-quiz-004/answer.md).

The conclusion is that USDT rejects nonzero-to-nonzero `approve` changes, so the first run works from zero allowance, then later runs fail because partial spend leaves residual allowance behind. The minimal fix is to use OZ v5 `SafeERC20.forceApprove(...)`, and the general allowance policy should be to keep approvals exact and clear leftovers back to zero when practical.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..e0063c9584a82105965f0614fac0ccaa6c4f289b
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,29 @@
+USDT is the outlier because its `approve` implementation enforces the old "set to zero before changing to another nonzero allowance" rule. In practice:
+
+1. The first run succeeds because the router starts with `allowance(router, strategy) == 0`, so `approve(strategy, amount)` is a zero-to-nonzero change.
+2. The strategy then spends only part of that allowance, so some nonzero allowance remains.
+3. On the next run, the router again does `approve(strategy, amount)` while the current allowance is still nonzero.
+4. USDT rejects that nonzero-to-nonzero allowance update, so the low-level `call` returns `ok == false` and the router reverts at `require(ok, "approve failed")`.
+
+USDC does not enforce that rule, so repeated nonzero-to-nonzero approvals keep succeeding there.
+
+The minimal fix is to replace the raw low-level approve call with OpenZeppelin v5's `SafeERC20.forceApprove`, which handles this token class by zeroing first when needed.
+
+Example:
+
+```solidity
+using SafeERC20 for IERC20;
+
+IERC20(token).forceApprove(strategy, amount);
+```
+
+`forceApprove` is the right OZ v5 primitive here specifically because `safeApprove` was removed and this exact compatibility issue is why `forceApprove` exists.
+
+About leftover allowance in general: the router should not assume the previous allowance is harmless. If the strategy only partially spends approval, that residual allowance remains live and can interfere with later approval flows on tokens like USDT. More importantly, leftover allowance is standing authorization, so it should be minimized.
+
+The general policy should be:
+
+- approve only the amount needed for the current run; and
+- clear any leftover allowance back to zero when practical after the strategy pull/spend is done, especially if approvals are not intended to stay open.
+
+If the router must support arbitrary ERC-20s and repeated runs, `forceApprove` is the minimal compatibility fix, and zeroing residual allowance after use is the safer allowance hygiene.

tokens used
9,191
````

## final message

Wrote the answer to [answer.md](/home/damu/.cache/ethskills-evals/2026-09-04T125935Z-codex-with-skill-3/security-quiz-004/answer.md).

The conclusion is that USDT rejects nonzero-to-nonzero `approve` changes, so the first run works from zero allowance, then later runs fail because partial spend leaves residual allowance behind. The minimal fix is to use OZ v5 `SafeERC20.forceApprove(...)`, and the general allowance policy should be to keep approvals exact and clear leftovers back to zero when practical.
