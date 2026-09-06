# Executor transcript — 2026-09-04T125930Z-codex-with-skill-3

**executor**: codex  |  **model**: gpt-5.4  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-04T125930Z-codex-with-skill-3/security-quiz-003

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /home/damu/.cache/ethskills-evals/2026-09-04T125930Z-codex-with-skill-3/security-quiz-003
model: gpt-5.4
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06c8a-454a-73a0-ad5c-b787f439db05
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

codex
I’m treating this as a staking-contract security/accounting analysis. I’ll read the local `security` skill instructions first, then inspect the workspace and write the answer into `answer.md`.
exec
/bin/bash -lc "sed -n '1,220p' /home/damu/.cache/ethskills-evals/2026-09-04T125930Z-codex-with-skill-3/security-quiz-003/.agents/skills/security/SKILL.md" in /home/damu/.cache/ethskills-evals/2026-09-04T125930Z-codex-with-skill-3/security-quiz-003
 succeeded in 7ms:
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

exec
/bin/bash -lc 'rg --files .' in /home/damu/.cache/ethskills-evals/2026-09-04T125930Z-codex-with-skill-3/security-quiz-003
 succeeded in 5ms:
./TASK.md
./package.json

codex
The workspace is minimal, so I’m checking the task file for any formatting constraints before I write `answer.md`. After that I’ll draft the reasoning and save it directly in the repo.
exec
/bin/bash -lc "sed -n '1,220p' TASK.md" in /home/damu/.cache/ethskills-evals/2026-09-04T125930Z-codex-with-skill-3/security-quiz-003
 succeeded in 0ms:
exec
/bin/bash -lc pwd in /home/damu/.cache/ethskills-evals/2026-09-04T125930Z-codex-with-skill-3/security-quiz-003
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
/home/damu/.cache/ethskills-evals/2026-09-04T125930Z-codex-with-skill-3/security-quiz-003

codex
I’ve pinned the root cause: this is a fee-on-transfer token being treated like a plain ERC-20. I’m writing the answer now, including the arithmetic for the missing `25,000 TKN`, why the deficit worsens over time, and the consequence for the currently stuck stakers.
apply patch
patch: completed
/home/damu/.cache/ethskills-evals/2026-09-04T125930Z-codex-with-skill-3/security-quiz-003/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..98a6d754a10db3cda034b894d61d9fe4ef21c481
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,103 @@
+The pool is accounting for the **requested transfer amount**, not the **tokens actually received**. That only breaks this badly if `TKN` is a fee-on-transfer token.
+
+The user example gives the fee rate away:
+
+- user stakes `10,000`
+- UI credits `10,000`
+- on full unstake, wallet receives `9,800`
+
+That is a `2%` transfer tax on the outbound transfer. The pool data shows the same thing happened on deposits too.
+
+## Where the missing 25,000 TKN went
+
+Cumulative stakes are recorded as `1,250,000 TKN`, but if `TKN` charges `2%` on `transferFrom`, the pool actually received only:
+
+`1,250,000 * 98% = 1,225,000 TKN`
+
+So `25,000 TKN` never reached the pool. It was taken by the token itself on stake transfers, likely burned or redirected by the token's fee logic.
+
+The pool still credited stakers with the full `1,250,000`, because it does:
+
+```solidity
+token.transferFrom(msg.sender, address(this), amount);
+stakedBalance[msg.sender] += amount;
+```
+
+That creates an immediate accounting hole of `25,000 TKN`.
+
+## Why the numbers reconcile exactly
+
+Recorded activity:
+
+- total staked: `1,250,000`
+- total unstaked: `250,000`
+- therefore recorded live balances: `1,000,000`
+
+Real assets:
+
+- actual tokens received from all stakes: `1,225,000`
+- pool sent out `250,000` on unstakes
+- remaining balance: `975,000`
+
+So:
+
+`1,225,000 - 250,000 = 975,000`
+
+and
+
+`1,000,000 - 975,000 = 25,000`
+
+That missing `25,000` is the sum of the inbound transfer fees that were never accounted for.
+
+## Why the shortfall grows
+
+Each new stake makes the pool more insolvent.
+
+For a stake of `amount`, if the token takes `2%`, the pool receives only `0.98 * amount` but credits `amount`. So every deposit increases the deficit by:
+
+`amount - actualReceived`
+
+At `2%`, a `100,000 TKN` stake grows the hole by `2,000 TKN`.
+
+Early unstakers succeeded because the pool still had enough real tokens from later depositors to pay them. Late unstakers are reverting because the internal ledger promises more tokens than the contract actually holds.
+
+## Why the example user lost money both ways
+
+For a `10,000 TKN` stake:
+
+- the pool likely received only `9,800`
+- but credited the user `10,000`
+
+When that user later unstaked `10,000`, the pool sent `10,000`, and the token again taxed the transfer, so the wallet received `9,800`.
+
+So that user was taxed on the way in and on the way out. The pool hid the inbound tax in its broken accounting, then exposed the outbound tax when the user withdrew.
+
+## Correct change
+
+The fix is to credit deposits by the contract's balance delta, not by the requested amount:
+
+```solidity
+function stake(uint256 amount) external {
+    uint256 beforeBal = token.balanceOf(address(this));
+    token.transferFrom(msg.sender, address(this), amount);
+    uint256 received = token.balanceOf(address(this)) - beforeBal;
+    stakedBalance[msg.sender] += received;
+}
+```
+
+Using `SafeERC20.safeTransferFrom` is preferable, but the key accounting fix is: **credit `received`, not `amount`**.
+
+Equivalent safe design: revert unless `received == amount`, which simply rejects fee-on-transfer tokens.
+
+## What happens to the stakers who cannot currently unstake
+
+The fix prevents **new** bad accounting, but it does not repair the existing insolvency.
+
+Right now the pool owes `1,000,000 TKN` by its internal ledger and only has `975,000 TKN`. That means current stakers as a group are undercollateralized by `25,000 TKN`.
+
+So one of these must happen:
+
+- someone recapitalizes the pool with `25,000 TKN`, after which all current recorded balances can be honored; or
+- the pool writes balances down to the assets actually present, which means current stakers absorb the `25,000 TKN` loss pro rata.
+
+Without recapitalization, the users currently reverting cannot all be paid their recorded balances in full, because those tokens are not in the contract and never were.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..98a6d754a10db3cda034b894d61d9fe4ef21c481
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,103 @@
+The pool is accounting for the **requested transfer amount**, not the **tokens actually received**. That only breaks this badly if `TKN` is a fee-on-transfer token.
+
+The user example gives the fee rate away:
+
+- user stakes `10,000`
+- UI credits `10,000`
+- on full unstake, wallet receives `9,800`
+
+That is a `2%` transfer tax on the outbound transfer. The pool data shows the same thing happened on deposits too.
+
+## Where the missing 25,000 TKN went
+
+Cumulative stakes are recorded as `1,250,000 TKN`, but if `TKN` charges `2%` on `transferFrom`, the pool actually received only:
+
+`1,250,000 * 98% = 1,225,000 TKN`
+
+So `25,000 TKN` never reached the pool. It was taken by the token itself on stake transfers, likely burned or redirected by the token's fee logic.
+
+The pool still credited stakers with the full `1,250,000`, because it does:
+
+```solidity
+token.transferFrom(msg.sender, address(this), amount);
+stakedBalance[msg.sender] += amount;
+```
+
+That creates an immediate accounting hole of `25,000 TKN`.
+
+## Why the numbers reconcile exactly
+
+Recorded activity:
+
+- total staked: `1,250,000`
+- total unstaked: `250,000`
+- therefore recorded live balances: `1,000,000`
+
+Real assets:
+
+- actual tokens received from all stakes: `1,225,000`
+- pool sent out `250,000` on unstakes
+- remaining balance: `975,000`
+
+So:
+
+`1,225,000 - 250,000 = 975,000`
+
+and
+
+`1,000,000 - 975,000 = 25,000`
+
+That missing `25,000` is the sum of the inbound transfer fees that were never accounted for.
+
+## Why the shortfall grows
+
+Each new stake makes the pool more insolvent.
+
+For a stake of `amount`, if the token takes `2%`, the pool receives only `0.98 * amount` but credits `amount`. So every deposit increases the deficit by:
+
+`amount - actualReceived`
+
+At `2%`, a `100,000 TKN` stake grows the hole by `2,000 TKN`.
+
+Early unstakers succeeded because the pool still had enough real tokens from later depositors to pay them. Late unstakers are reverting because the internal ledger promises more tokens than the contract actually holds.
+
+## Why the example user lost money both ways
+
+For a `10,000 TKN` stake:
+
+- the pool likely received only `9,800`
+- but credited the user `10,000`
+
+When that user later unstaked `10,000`, the pool sent `10,000`, and the token again taxed the transfer, so the wallet received `9,800`.
+
+So that user was taxed on the way in and on the way out. The pool hid the inbound tax in its broken accounting, then exposed the outbound tax when the user withdrew.
+
+## Correct change
+
+The fix is to credit deposits by the contract's balance delta, not by the requested amount:
+
+```solidity
+function stake(uint256 amount) external {
+    uint256 beforeBal = token.balanceOf(address(this));
+    token.transferFrom(msg.sender, address(this), amount);
+    uint256 received = token.balanceOf(address(this)) - beforeBal;
+    stakedBalance[msg.sender] += received;
+}
+```
+
+Using `SafeERC20.safeTransferFrom` is preferable, but the key accounting fix is: **credit `received`, not `amount`**.
+
+Equivalent safe design: revert unless `received == amount`, which simply rejects fee-on-transfer tokens.
+
+## What happens to the stakers who cannot currently unstake
+
+The fix prevents **new** bad accounting, but it does not repair the existing insolvency.
+
+Right now the pool owes `1,000,000 TKN` by its internal ledger and only has `975,000 TKN`. That means current stakers as a group are undercollateralized by `25,000 TKN`.
+
+So one of these must happen:
+
+- someone recapitalizes the pool with `25,000 TKN`, after which all current recorded balances can be honored; or
+- the pool writes balances down to the assets actually present, which means current stakers absorb the `25,000 TKN` loss pro rata.
+
+Without recapitalization, the users currently reverting cannot all be paid their recorded balances in full, because those tokens are not in the contract and never were.

codex
`answer.md` is in place. I’m doing a quick readback now to make sure the explanation is internally consistent and matches the observed balances precisely.
exec
/bin/bash -lc "sed -n '1,260p' answer.md" in /home/damu/.cache/ethskills-evals/2026-09-04T125930Z-codex-with-skill-3/security-quiz-003
 succeeded in 3ms:
The pool is accounting for the **requested transfer amount**, not the **tokens actually received**. That only breaks this badly if `TKN` is a fee-on-transfer token.

The user example gives the fee rate away:

- user stakes `10,000`
- UI credits `10,000`
- on full unstake, wallet receives `9,800`

That is a `2%` transfer tax on the outbound transfer. The pool data shows the same thing happened on deposits too.

## Where the missing 25,000 TKN went

Cumulative stakes are recorded as `1,250,000 TKN`, but if `TKN` charges `2%` on `transferFrom`, the pool actually received only:

`1,250,000 * 98% = 1,225,000 TKN`

So `25,000 TKN` never reached the pool. It was taken by the token itself on stake transfers, likely burned or redirected by the token's fee logic.

The pool still credited stakers with the full `1,250,000`, because it does:

```solidity
token.transferFrom(msg.sender, address(this), amount);
stakedBalance[msg.sender] += amount;
```

That creates an immediate accounting hole of `25,000 TKN`.

## Why the numbers reconcile exactly

Recorded activity:

- total staked: `1,250,000`
- total unstaked: `250,000`
- therefore recorded live balances: `1,000,000`

Real assets:

- actual tokens received from all stakes: `1,225,000`
- pool sent out `250,000` on unstakes
- remaining balance: `975,000`

So:

`1,225,000 - 250,000 = 975,000`

and

`1,000,000 - 975,000 = 25,000`

That missing `25,000` is the sum of the inbound transfer fees that were never accounted for.

## Why the shortfall grows

Each new stake makes the pool more insolvent.

For a stake of `amount`, if the token takes `2%`, the pool receives only `0.98 * amount` but credits `amount`. So every deposit increases the deficit by:

`amount - actualReceived`

At `2%`, a `100,000 TKN` stake grows the hole by `2,000 TKN`.

Early unstakers succeeded because the pool still had enough real tokens from later depositors to pay them. Late unstakers are reverting because the internal ledger promises more tokens than the contract actually holds.

## Why the example user lost money both ways

For a `10,000 TKN` stake:

- the pool likely received only `9,800`
- but credited the user `10,000`

When that user later unstaked `10,000`, the pool sent `10,000`, and the token again taxed the transfer, so the wallet received `9,800`.

So that user was taxed on the way in and on the way out. The pool hid the inbound tax in its broken accounting, then exposed the outbound tax when the user withdrew.

## Correct change

The fix is to credit deposits by the contract's balance delta, not by the requested amount:

```solidity
function stake(uint256 amount) external {
    uint256 beforeBal = token.balanceOf(address(this));
    token.transferFrom(msg.sender, address(this), amount);
    uint256 received = token.balanceOf(address(this)) - beforeBal;
    stakedBalance[msg.sender] += received;
}
```

Using `SafeERC20.safeTransferFrom` is preferable, but the key accounting fix is: **credit `received`, not `amount`**.

Equivalent safe design: revert unless `received == amount`, which simply rejects fee-on-transfer tokens.

## What happens to the stakers who cannot currently unstake

The fix prevents **new** bad accounting, but it does not repair the existing insolvency.

Right now the pool owes `1,000,000 TKN` by its internal ledger and only has `975,000 TKN`. That means current stakers as a group are undercollateralized by `25,000 TKN`.

So one of these must happen:

- someone recapitalizes the pool with `25,000 TKN`, after which all current recorded balances can be honored; or
- the pool writes balances down to the assets actually present, which means current stakers absorb the `25,000 TKN` loss pro rata.

Without recapitalization, the users currently reverting cannot all be paid their recorded balances in full, because those tokens are not in the contract and never were.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..98a6d754a10db3cda034b894d61d9fe4ef21c481
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,103 @@
+The pool is accounting for the **requested transfer amount**, not the **tokens actually received**. That only breaks this badly if `TKN` is a fee-on-transfer token.
+
+The user example gives the fee rate away:
+
+- user stakes `10,000`
+- UI credits `10,000`
+- on full unstake, wallet receives `9,800`
+
+That is a `2%` transfer tax on the outbound transfer. The pool data shows the same thing happened on deposits too.
+
+## Where the missing 25,000 TKN went
+
+Cumulative stakes are recorded as `1,250,000 TKN`, but if `TKN` charges `2%` on `transferFrom`, the pool actually received only:
+
+`1,250,000 * 98% = 1,225,000 TKN`
+
+So `25,000 TKN` never reached the pool. It was taken by the token itself on stake transfers, likely burned or redirected by the token's fee logic.
+
+The pool still credited stakers with the full `1,250,000`, because it does:
+
+```solidity
+token.transferFrom(msg.sender, address(this), amount);
+stakedBalance[msg.sender] += amount;
+```
+
+That creates an immediate accounting hole of `25,000 TKN`.
+
+## Why the numbers reconcile exactly
+
+Recorded activity:
+
+- total staked: `1,250,000`
+- total unstaked: `250,000`
+- therefore recorded live balances: `1,000,000`
+
+Real assets:
+
+- actual tokens received from all stakes: `1,225,000`
+- pool sent out `250,000` on unstakes
+- remaining balance: `975,000`
+
+So:
+
+`1,225,000 - 250,000 = 975,000`
+
+and
+
+`1,000,000 - 975,000 = 25,000`
+
+That missing `25,000` is the sum of the inbound transfer fees that were never accounted for.
+
+## Why the shortfall grows
+
+Each new stake makes the pool more insolvent.
+
+For a stake of `amount`, if the token takes `2%`, the pool receives only `0.98 * amount` but credits `amount`. So every deposit increases the deficit by:
+
+`amount - actualReceived`
+
+At `2%`, a `100,000 TKN` stake grows the hole by `2,000 TKN`.
+
+Early unstakers succeeded because the pool still had enough real tokens from later depositors to pay them. Late unstakers are reverting because the internal ledger promises more tokens than the contract actually holds.
+
+## Why the example user lost money both ways
+
+For a `10,000 TKN` stake:
+
+- the pool likely received only `9,800`
+- but credited the user `10,000`
+
+When that user later unstaked `10,000`, the pool sent `10,000`, and the token again taxed the transfer, so the wallet received `9,800`.
+
+So that user was taxed on the way in and on the way out. The pool hid the inbound tax in its broken accounting, then exposed the outbound tax when the user withdrew.
+
+## Correct change
+
+The fix is to credit deposits by the contract's balance delta, not by the requested amount:
+
+```solidity
+function stake(uint256 amount) external {
+    uint256 beforeBal = token.balanceOf(address(this));
+    token.transferFrom(msg.sender, address(this), amount);
+    uint256 received = token.balanceOf(address(this)) - beforeBal;
+    stakedBalance[msg.sender] += received;
+}
+```
+
+Using `SafeERC20.safeTransferFrom` is preferable, but the key accounting fix is: **credit `received`, not `amount`**.
+
+Equivalent safe design: revert unless `received == amount`, which simply rejects fee-on-transfer tokens.
+
+## What happens to the stakers who cannot currently unstake
+
+The fix prevents **new** bad accounting, but it does not repair the existing insolvency.
+
+Right now the pool owes `1,000,000 TKN` by its internal ledger and only has `975,000 TKN`. That means current stakers as a group are undercollateralized by `25,000 TKN`.
+
+So one of these must happen:
+
+- someone recapitalizes the pool with `25,000 TKN`, after which all current recorded balances can be honored; or
+- the pool writes balances down to the assets actually present, which means current stakers absorb the `25,000 TKN` loss pro rata.
+
+Without recapitalization, the users currently reverting cannot all be paid their recorded balances in full, because those tokens are not in the contract and never were.

codex
Wrote the analysis to [answer.md](/home/damu/.cache/ethskills-evals/2026-09-04T125930Z-codex-with-skill-3/security-quiz-003/answer.md).

The conclusion is that `TKN` is fee-on-transfer at `2%`, the pool credits deposits by the requested amount instead of the amount actually received, and that created the `25,000 TKN` insolvency (`1,250,000 * 2%`). The fix in the write-up is to credit `stake()` by the contract’s balance delta, with the note that current stuck stakers still cannot all be made whole unless the pool is recapitalized or balances are haircut pro rata.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..98a6d754a10db3cda034b894d61d9fe4ef21c481
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,103 @@
+The pool is accounting for the **requested transfer amount**, not the **tokens actually received**. That only breaks this badly if `TKN` is a fee-on-transfer token.
+
+The user example gives the fee rate away:
+
+- user stakes `10,000`
+- UI credits `10,000`
+- on full unstake, wallet receives `9,800`
+
+That is a `2%` transfer tax on the outbound transfer. The pool data shows the same thing happened on deposits too.
+
+## Where the missing 25,000 TKN went
+
+Cumulative stakes are recorded as `1,250,000 TKN`, but if `TKN` charges `2%` on `transferFrom`, the pool actually received only:
+
+`1,250,000 * 98% = 1,225,000 TKN`
+
+So `25,000 TKN` never reached the pool. It was taken by the token itself on stake transfers, likely burned or redirected by the token's fee logic.
+
+The pool still credited stakers with the full `1,250,000`, because it does:
+
+```solidity
+token.transferFrom(msg.sender, address(this), amount);
+stakedBalance[msg.sender] += amount;
+```
+
+That creates an immediate accounting hole of `25,000 TKN`.
+
+## Why the numbers reconcile exactly
+
+Recorded activity:
+
+- total staked: `1,250,000`
+- total unstaked: `250,000`
+- therefore recorded live balances: `1,000,000`
+
+Real assets:
+
+- actual tokens received from all stakes: `1,225,000`
+- pool sent out `250,000` on unstakes
+- remaining balance: `975,000`
+
+So:
+
+`1,225,000 - 250,000 = 975,000`
+
+and
+
+`1,000,000 - 975,000 = 25,000`
+
+That missing `25,000` is the sum of the inbound transfer fees that were never accounted for.
+
+## Why the shortfall grows
+
+Each new stake makes the pool more insolvent.
+
+For a stake of `amount`, if the token takes `2%`, the pool receives only `0.98 * amount` but credits `amount`. So every deposit increases the deficit by:
+
+`amount - actualReceived`
+
+At `2%`, a `100,000 TKN` stake grows the hole by `2,000 TKN`.
+
+Early unstakers succeeded because the pool still had enough real tokens from later depositors to pay them. Late unstakers are reverting because the internal ledger promises more tokens than the contract actually holds.
+
+## Why the example user lost money both ways
+
+For a `10,000 TKN` stake:
+
+- the pool likely received only `9,800`
+- but credited the user `10,000`
+
+When that user later unstaked `10,000`, the pool sent `10,000`, and the token again taxed the transfer, so the wallet received `9,800`.
+
+So that user was taxed on the way in and on the way out. The pool hid the inbound tax in its broken accounting, then exposed the outbound tax when the user withdrew.
+
+## Correct change
+
+The fix is to credit deposits by the contract's balance delta, not by the requested amount:
+
+```solidity
+function stake(uint256 amount) external {
+    uint256 beforeBal = token.balanceOf(address(this));
+    token.transferFrom(msg.sender, address(this), amount);
+    uint256 received = token.balanceOf(address(this)) - beforeBal;
+    stakedBalance[msg.sender] += received;
+}
+```
+
+Using `SafeERC20.safeTransferFrom` is preferable, but the key accounting fix is: **credit `received`, not `amount`**.
+
+Equivalent safe design: revert unless `received == amount`, which simply rejects fee-on-transfer tokens.
+
+## What happens to the stakers who cannot currently unstake
+
+The fix prevents **new** bad accounting, but it does not repair the existing insolvency.
+
+Right now the pool owes `1,000,000 TKN` by its internal ledger and only has `975,000 TKN`. That means current stakers as a group are undercollateralized by `25,000 TKN`.
+
+So one of these must happen:
+
+- someone recapitalizes the pool with `25,000 TKN`, after which all current recorded balances can be honored; or
+- the pool writes balances down to the assets actually present, which means current stakers absorb the `25,000 TKN` loss pro rata.
+
+Without recapitalization, the users currently reverting cannot all be paid their recorded balances in full, because those tokens are not in the contract and never were.

tokens used
13,763
````

## final message

Wrote the analysis to [answer.md](/home/damu/.cache/ethskills-evals/2026-09-04T125930Z-codex-with-skill-3/security-quiz-003/answer.md).

The conclusion is that `TKN` is fee-on-transfer at `2%`, the pool credits deposits by the requested amount instead of the amount actually received, and that created the `25,000 TKN` insolvency (`1,250,000 * 2%`). The fix in the write-up is to credit `stake()` by the contract’s balance delta, with the note that current stuck stakers still cannot all be made whole unless the pool is recapitalized or balances are haircut pro rata.
