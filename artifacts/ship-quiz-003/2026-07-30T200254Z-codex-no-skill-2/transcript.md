Reading additional input from stdin...
OpenAI Codex v0.146.0
--------
workdir: /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200254Z-codex-no-skill-2/workspace
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: high
reasoning summaries: none
session id: 019fb49f-6e7b-7cd2-9b4e-adb1a452f264
--------
user
We're building an onchain version of a savings circle — the thing my family
calls a susu. Twelve people put in $100 of USDC each month, and each month one
member takes the whole $1,200 pot; the order is fixed when the circle starts,
and everyone gets exactly one turn over the year. If someone misses a payment
they forfeit their turn, and their earlier contributions cover the shortfall
for that month's recipient.

There are two of us building this and we're both away for the next six weeks.
I want to know whether the circles that are already running keep working while
we're gone — and if not, exactly what breaks and what we'd have to do about
it.

Write your answer to plan.md in this directory: the contract design, plus the
answer to that.
codex
I’ll draft `plan.md` covering the contract mechanics and six-week unattended-operation risks.
exec
/bin/bash -lc "pwd && rg --files -g '"'!*node_modules*'"' -g '"'!*.lock'"' | head -100" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200254Z-codex-no-skill-2/workspace
 succeeded in 0ms:
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200254Z-codex-no-skill-2/workspace
TASK.md

exec
/bin/bash -lc "sed -n '1,240p' TASK.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200254Z-codex-no-skill-2/workspace
 succeeded in 0ms:
We're building an onchain version of a savings circle — the thing my family
calls a susu. Twelve people put in $100 of USDC each month, and each month one
member takes the whole $1,200 pot; the order is fixed when the circle starts,
and everyone gets exactly one turn over the year. If someone misses a payment
they forfeit their turn, and their earlier contributions cover the shortfall
for that month's recipient.

There are two of us building this and we're both away for the next six weeks.
I want to know whether the circles that are already running keep working while
we're gone — and if not, exactly what breaks and what we'd have to do about
it.

Write your answer to plan.md in this directory: the contract design, plus the
answer to that.

2026-07-30T20:04:18.628786Z ERROR codex_core::tools::router: error=apply_patch verification failed: invalid hunk at line 133, 'the recipient receive exactly 1,200 USDC.  Also test a keeper failure, because' is not a valid hunk header. Valid hunk headers: '*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'
apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200254Z-codex-no-skill-2/workspace/plan.md
diff --git a/artifacts/ship-quiz-003/2026-07-30T200254Z-codex-no-skill-2/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200254Z-codex-no-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..86fecd98060cbc9b43d8384a58caaecaac0dba45
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200254Z-codex-no-skill-2/workspace/plan.md
@@ -0,0 +1,62 @@
+# Susu contract and unattended-operation plan
+
+## Answer
+
+The chain preserves state but never wakes itself up. A transaction is required to record a payment, declare a missed payment, advance a round, or transfer a pot. Therefore existing circles keep operating for the six weeks only if their deployed contracts already permit an independent caller to perform every such transition, and someone/automation is funded to call them. An owner-only `advance`, `declareDefault`, or `payout` stalls at its next required transition.
+
+No deployed address or ABI was provided, so the status of current circles cannot be confirmed from this brief. Check each address against the go/no-go list before leaving.
+
+## First resolve the economics
+
+"Earlier contributions cover the shortfall" is not automatically possible: earlier $100 payments have normally been sent in earlier pots, so cannot also cover a new missed $100. A member who has already received $1,200 also has no remaining turn to forfeit. And if an unpaid member loses a fixed slot, the product must say whether that slot is skipped, reassigned, or paid from reserve.
+
+For guaranteed $1,200 pots, choose one model explicitly:
+
+- Best: escrow each member's full annual commitment ($1,200 USDC) at creation, then release one $1,200 pot per month. Failure to fund means no admission; there is no later collection default.
+- If monthly payments are essential: lock separate liquid collateral/reserve. To guarantee all later pots after an early payout, collateral must cover a member's remaining unpaid instalments. A $100 bond only covers one missed month.
+
+The design below assumes monthly payments plus sufficient locked collateral. Do not label already distributed funds as a reserve.
+
+## Contract design
+
+Deploy one immutable `SusuCircle` per group (or a factory/proxy), with fixed constructor parameters: approved USDC address and on-chain `decimals()`, twelve unique member addresses, fixed payout slots, `startAt`, period, payment window, deadline/grace period, collateral/default rule, and a capped successful-settlement reward. Calculate `monthlyDue = 100 * 10**decimals`; do not assume every supported token has six decimals.
+
+Store `round`, `paid[round][member]`, `memberStatus` (`active`, `defaulted`, `paidOut`), `lockedCollateral`, `reserve`, and `settled[round]`. Emit funding, payment, default, settlement, payout, and collateral-release events. Use `SafeERC20`, reentrancy protection, checks-effects-interactions, and reject fee-on-transfer tokens. Support only the selected USDC.
+
+Required functions:
+
+1. `joinAndFund`: only the precommitted member, pulls required collateral with approval or permit.
+2. `pay(round)`: only during that round's payment window; pulls one due and records it.
+3. `settleRound(round)`: callable by **any address** after deadline; marks unpaid members defaulted, moves only locked collateral to reserve, selects recipient by the disclosed slot rule, and pays the caller reward only on success. It must revert if the reserve cannot make the pot whole; that is an honest insolvency state.
+4. `claimPot(round)`: selected recipient claims, or settlement transfers atomically, only once accounting proves $1,200 is available.
+5. `finalize`: after all rounds and a claims window, returns unused collateral/reserve exactly per the written rule.
+
+Use timestamps only for coarse windows and permit early payment. State transitions must be idempotent/safely reject repeats. A fixed twelve-member loop is bounded and acceptable.
+
+USDC approval is not guaranteed collection: a user can revoke it or lack balance. Permit/allowance lets a keeper attempt collection; it cannot make an unfunded wallet pay. Default settlement must remain correct.
+
+## Unattended operation
+
+Permissionless settlement is the liveness mechanism. Any member, recipient, or keeper should call `settleRound`; the recipient has an incentive even if automation fails. Two independent automation paths may call the same public function, with funded gas balances and alerts, but neither needs special payout authority. A multisig may hold only narrow, time-locked pause/recovery authority; it must not reorder recipients or move pots.
+
+Never depend on a frontend, cron job, one server, one builder EOA, or an owner-only keeper. Automation cannot bypass access control, repair insolvency, or pull from an unapproved/unfunded wallet.
+
+## Six-week go/no-go for existing circles
+
+| Check | Pass condition | Failure / action |
+| --- | --- | --- |
+| Access | Unrelated address can settle after deadline; recipient can claim | Owner-only transition stalls; arrange tested authorized operator or migrate/redeploy |
+| Calendar | Current round and next six weeks fall in valid payment/deadline windows | Bad/uninitialized timing can lock flow; use authorized recovery before departure |
+| Solvency | USDC balance plus reserve covers each due $1,200 pot | Fund shortfall or invoke documented default rule; keeper cannot fix it |
+| Collection/default | Every due is paid, or allowance+balance exist; failed collection settles deterministically | Contact member or use real collateral/default path |
+| Automation | At least one keeper has correct address/ABI, funds, and a successful test transaction | No scheduled call; rely on public settlement plus a volunteer |
+| Control | Pause/upgrade is reachable multisig; no travel-dependent single key | Move/confirm authority before leaving |
+| Alerts | Monitor deadlines, failed jobs, `RoundSettled`, and low reserve | Problems may outlive grace period unnoticed |
+
+Rehearse on a fork/testnet from present state: a non-owner pays; after deadline a non-owner settles; simulate a missed payment; prove reserve fills exactly its defined shortfall; prove recipient gets exactly $1,200; then simulate keeper failure and use the public fallback.
+
+## Recommendation
+
+Do not promise unattended continuity until every check passes. If public settlement and viable reserve already exist, fund/test automation, notify members of payment dates and the public fallback, and alert remotely. If a critical transition is owner-only, arrange an authorized operator, pause new circles, or redeploy/migrate before the next deadline.
+
+Obtain jurisdiction-specific legal review of pooled funds/custody, defaults, sanctions/KYC, and consumer disclosures before launch; those rules may constrain the administrator and recovery design.

diff --git a/artifacts/ship-quiz-003/2026-07-30T200254Z-codex-no-skill-2/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200254Z-codex-no-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..86fecd98060cbc9b43d8384a58caaecaac0dba45
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200254Z-codex-no-skill-2/workspace/plan.md
@@ -0,0 +1,62 @@
+# Susu contract and unattended-operation plan
+
+## Answer
+
+The chain preserves state but never wakes itself up. A transaction is required to record a payment, declare a missed payment, advance a round, or transfer a pot. Therefore existing circles keep operating for the six weeks only if their deployed contracts already permit an independent caller to perform every such transition, and someone/automation is funded to call them. An owner-only `advance`, `declareDefault`, or `payout` stalls at its next required transition.
+
+No deployed address or ABI was provided, so the status of current circles cannot be confirmed from this brief. Check each address against the go/no-go list before leaving.
+
+## First resolve the economics
+
+"Earlier contributions cover the shortfall" is not automatically possible: earlier $100 payments have normally been sent in earlier pots, so cannot also cover a new missed $100. A member who has already received $1,200 also has no remaining turn to forfeit. And if an unpaid member loses a fixed slot, the product must say whether that slot is skipped, reassigned, or paid from reserve.
+
+For guaranteed $1,200 pots, choose one model explicitly:
+
+- Best: escrow each member's full annual commitment ($1,200 USDC) at creation, then release one $1,200 pot per month. Failure to fund means no admission; there is no later collection default.
+- If monthly payments are essential: lock separate liquid collateral/reserve. To guarantee all later pots after an early payout, collateral must cover a member's remaining unpaid instalments. A $100 bond only covers one missed month.
+
+The design below assumes monthly payments plus sufficient locked collateral. Do not label already distributed funds as a reserve.
+
+## Contract design
+
+Deploy one immutable `SusuCircle` per group (or a factory/proxy), with fixed constructor parameters: approved USDC address and on-chain `decimals()`, twelve unique member addresses, fixed payout slots, `startAt`, period, payment window, deadline/grace period, collateral/default rule, and a capped successful-settlement reward. Calculate `monthlyDue = 100 * 10**decimals`; do not assume every supported token has six decimals.
+
+Store `round`, `paid[round][member]`, `memberStatus` (`active`, `defaulted`, `paidOut`), `lockedCollateral`, `reserve`, and `settled[round]`. Emit funding, payment, default, settlement, payout, and collateral-release events. Use `SafeERC20`, reentrancy protection, checks-effects-interactions, and reject fee-on-transfer tokens. Support only the selected USDC.
+
+Required functions:
+
+1. `joinAndFund`: only the precommitted member, pulls required collateral with approval or permit.
+2. `pay(round)`: only during that round's payment window; pulls one due and records it.
+3. `settleRound(round)`: callable by **any address** after deadline; marks unpaid members defaulted, moves only locked collateral to reserve, selects recipient by the disclosed slot rule, and pays the caller reward only on success. It must revert if the reserve cannot make the pot whole; that is an honest insolvency state.
+4. `claimPot(round)`: selected recipient claims, or settlement transfers atomically, only once accounting proves $1,200 is available.
+5. `finalize`: after all rounds and a claims window, returns unused collateral/reserve exactly per the written rule.
+
+Use timestamps only for coarse windows and permit early payment. State transitions must be idempotent/safely reject repeats. A fixed twelve-member loop is bounded and acceptable.
+
+USDC approval is not guaranteed collection: a user can revoke it or lack balance. Permit/allowance lets a keeper attempt collection; it cannot make an unfunded wallet pay. Default settlement must remain correct.
+
+## Unattended operation
+
+Permissionless settlement is the liveness mechanism. Any member, recipient, or keeper should call `settleRound`; the recipient has an incentive even if automation fails. Two independent automation paths may call the same public function, with funded gas balances and alerts, but neither needs special payout authority. A multisig may hold only narrow, time-locked pause/recovery authority; it must not reorder recipients or move pots.
+
+Never depend on a frontend, cron job, one server, one builder EOA, or an owner-only keeper. Automation cannot bypass access control, repair insolvency, or pull from an unapproved/unfunded wallet.
+
+## Six-week go/no-go for existing circles
+
+| Check | Pass condition | Failure / action |
+| --- | --- | --- |
+| Access | Unrelated address can settle after deadline; recipient can claim | Owner-only transition stalls; arrange tested authorized operator or migrate/redeploy |
+| Calendar | Current round and next six weeks fall in valid payment/deadline windows | Bad/uninitialized timing can lock flow; use authorized recovery before departure |
+| Solvency | USDC balance plus reserve covers each due $1,200 pot | Fund shortfall or invoke documented default rule; keeper cannot fix it |
+| Collection/default | Every due is paid, or allowance+balance exist; failed collection settles deterministically | Contact member or use real collateral/default path |
+| Automation | At least one keeper has correct address/ABI, funds, and a successful test transaction | No scheduled call; rely on public settlement plus a volunteer |
+| Control | Pause/upgrade is reachable multisig; no travel-dependent single key | Move/confirm authority before leaving |
+| Alerts | Monitor deadlines, failed jobs, `RoundSettled`, and low reserve | Problems may outlive grace period unnoticed |
+
+Rehearse on a fork/testnet from present state: a non-owner pays; after deadline a non-owner settles; simulate a missed payment; prove reserve fills exactly its defined shortfall; prove recipient gets exactly $1,200; then simulate keeper failure and use the public fallback.
+
+## Recommendation
+
+Do not promise unattended continuity until every check passes. If public settlement and viable reserve already exist, fund/test automation, notify members of payment dates and the public fallback, and alert remotely. If a critical transition is owner-only, arrange an authorized operator, pause new circles, or redeploy/migrate before the next deadline.
+
+Obtain jurisdiction-specific legal review of pooled funds/custody, defaults, sanctions/KYC, and consumer disclosures before launch; those rules may constrain the administrator and recovery design.

exec
/bin/bash -lc "sed -n '1,260p' plan.md && git diff --check" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200254Z-codex-no-skill-2/workspace
 succeeded in 0ms:
# Susu contract and unattended-operation plan

## Answer

The chain preserves state but never wakes itself up. A transaction is required to record a payment, declare a missed payment, advance a round, or transfer a pot. Therefore existing circles keep operating for the six weeks only if their deployed contracts already permit an independent caller to perform every such transition, and someone/automation is funded to call them. An owner-only `advance`, `declareDefault`, or `payout` stalls at its next required transition.

No deployed address or ABI was provided, so the status of current circles cannot be confirmed from this brief. Check each address against the go/no-go list before leaving.

## First resolve the economics

"Earlier contributions cover the shortfall" is not automatically possible: earlier $100 payments have normally been sent in earlier pots, so cannot also cover a new missed $100. A member who has already received $1,200 also has no remaining turn to forfeit. And if an unpaid member loses a fixed slot, the product must say whether that slot is skipped, reassigned, or paid from reserve.

For guaranteed $1,200 pots, choose one model explicitly:

- Best: escrow each member's full annual commitment ($1,200 USDC) at creation, then release one $1,200 pot per month. Failure to fund means no admission; there is no later collection default.
- If monthly payments are essential: lock separate liquid collateral/reserve. To guarantee all later pots after an early payout, collateral must cover a member's remaining unpaid instalments. A $100 bond only covers one missed month.

The design below assumes monthly payments plus sufficient locked collateral. Do not label already distributed funds as a reserve.

## Contract design

Deploy one immutable `SusuCircle` per group (or a factory/proxy), with fixed constructor parameters: approved USDC address and on-chain `decimals()`, twelve unique member addresses, fixed payout slots, `startAt`, period, payment window, deadline/grace period, collateral/default rule, and a capped successful-settlement reward. Calculate `monthlyDue = 100 * 10**decimals`; do not assume every supported token has six decimals.

Store `round`, `paid[round][member]`, `memberStatus` (`active`, `defaulted`, `paidOut`), `lockedCollateral`, `reserve`, and `settled[round]`. Emit funding, payment, default, settlement, payout, and collateral-release events. Use `SafeERC20`, reentrancy protection, checks-effects-interactions, and reject fee-on-transfer tokens. Support only the selected USDC.

Required functions:

1. `joinAndFund`: only the precommitted member, pulls required collateral with approval or permit.
2. `pay(round)`: only during that round's payment window; pulls one due and records it.
3. `settleRound(round)`: callable by **any address** after deadline; marks unpaid members defaulted, moves only locked collateral to reserve, selects recipient by the disclosed slot rule, and pays the caller reward only on success. It must revert if the reserve cannot make the pot whole; that is an honest insolvency state.
4. `claimPot(round)`: selected recipient claims, or settlement transfers atomically, only once accounting proves $1,200 is available.
5. `finalize`: after all rounds and a claims window, returns unused collateral/reserve exactly per the written rule.

Use timestamps only for coarse windows and permit early payment. State transitions must be idempotent/safely reject repeats. A fixed twelve-member loop is bounded and acceptable.

USDC approval is not guaranteed collection: a user can revoke it or lack balance. Permit/allowance lets a keeper attempt collection; it cannot make an unfunded wallet pay. Default settlement must remain correct.

## Unattended operation

Permissionless settlement is the liveness mechanism. Any member, recipient, or keeper should call `settleRound`; the recipient has an incentive even if automation fails. Two independent automation paths may call the same public function, with funded gas balances and alerts, but neither needs special payout authority. A multisig may hold only narrow, time-locked pause/recovery authority; it must not reorder recipients or move pots.

Never depend on a frontend, cron job, one server, one builder EOA, or an owner-only keeper. Automation cannot bypass access control, repair insolvency, or pull from an unapproved/unfunded wallet.

## Six-week go/no-go for existing circles

| Check | Pass condition | Failure / action |
| --- | --- | --- |
| Access | Unrelated address can settle after deadline; recipient can claim | Owner-only transition stalls; arrange tested authorized operator or migrate/redeploy |
| Calendar | Current round and next six weeks fall in valid payment/deadline windows | Bad/uninitialized timing can lock flow; use authorized recovery before departure |
| Solvency | USDC balance plus reserve covers each due $1,200 pot | Fund shortfall or invoke documented default rule; keeper cannot fix it |
| Collection/default | Every due is paid, or allowance+balance exist; failed collection settles deterministically | Contact member or use real collateral/default path |
| Automation | At least one keeper has correct address/ABI, funds, and a successful test transaction | No scheduled call; rely on public settlement plus a volunteer |
| Control | Pause/upgrade is reachable multisig; no travel-dependent single key | Move/confirm authority before leaving |
| Alerts | Monitor deadlines, failed jobs, `RoundSettled`, and low reserve | Problems may outlive grace period unnoticed |

Rehearse on a fork/testnet from present state: a non-owner pays; after deadline a non-owner settles; simulate a missed payment; prove reserve fills exactly its defined shortfall; prove recipient gets exactly $1,200; then simulate keeper failure and use the public fallback.

## Recommendation

Do not promise unattended continuity until every check passes. If public settlement and viable reserve already exist, fund/test automation, notify members of payment dates and the public fallback, and alert remotely. If a critical transition is owner-only, arrange an authorized operator, pause new circles, or redeploy/migrate before the next deadline.

Obtain jurisdiction-specific legal review of pooled funds/custody, defaults, sanctions/KYC, and consumer disclosures before launch; those rules may constrain the administrator and recovery design.

diff --git a/artifacts/ship-quiz-003/2026-07-30T200254Z-codex-no-skill-2/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200254Z-codex-no-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..86fecd98060cbc9b43d8384a58caaecaac0dba45
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200254Z-codex-no-skill-2/workspace/plan.md
@@ -0,0 +1,62 @@
+# Susu contract and unattended-operation plan
+
+## Answer
+
+The chain preserves state but never wakes itself up. A transaction is required to record a payment, declare a missed payment, advance a round, or transfer a pot. Therefore existing circles keep operating for the six weeks only if their deployed contracts already permit an independent caller to perform every such transition, and someone/automation is funded to call them. An owner-only `advance`, `declareDefault`, or `payout` stalls at its next required transition.
+
+No deployed address or ABI was provided, so the status of current circles cannot be confirmed from this brief. Check each address against the go/no-go list before leaving.
+
+## First resolve the economics
+
+"Earlier contributions cover the shortfall" is not automatically possible: earlier $100 payments have normally been sent in earlier pots, so cannot also cover a new missed $100. A member who has already received $1,200 also has no remaining turn to forfeit. And if an unpaid member loses a fixed slot, the product must say whether that slot is skipped, reassigned, or paid from reserve.
+
+For guaranteed $1,200 pots, choose one model explicitly:
+
+- Best: escrow each member's full annual commitment ($1,200 USDC) at creation, then release one $1,200 pot per month. Failure to fund means no admission; there is no later collection default.
+- If monthly payments are essential: lock separate liquid collateral/reserve. To guarantee all later pots after an early payout, collateral must cover a member's remaining unpaid instalments. A $100 bond only covers one missed month.
+
+The design below assumes monthly payments plus sufficient locked collateral. Do not label already distributed funds as a reserve.
+
+## Contract design
+
+Deploy one immutable `SusuCircle` per group (or a factory/proxy), with fixed constructor parameters: approved USDC address and on-chain `decimals()`, twelve unique member addresses, fixed payout slots, `startAt`, period, payment window, deadline/grace period, collateral/default rule, and a capped successful-settlement reward. Calculate `monthlyDue = 100 * 10**decimals`; do not assume every supported token has six decimals.
+
+Store `round`, `paid[round][member]`, `memberStatus` (`active`, `defaulted`, `paidOut`), `lockedCollateral`, `reserve`, and `settled[round]`. Emit funding, payment, default, settlement, payout, and collateral-release events. Use `SafeERC20`, reentrancy protection, checks-effects-interactions, and reject fee-on-transfer tokens. Support only the selected USDC.
+
+Required functions:
+
+1. `joinAndFund`: only the precommitted member, pulls required collateral with approval or permit.
+2. `pay(round)`: only during that round's payment window; pulls one due and records it.
+3. `settleRound(round)`: callable by **any address** after deadline; marks unpaid members defaulted, moves only locked collateral to reserve, selects recipient by the disclosed slot rule, and pays the caller reward only on success. It must revert if the reserve cannot make the pot whole; that is an honest insolvency state.
+4. `claimPot(round)`: selected recipient claims, or settlement transfers atomically, only once accounting proves $1,200 is available.
+5. `finalize`: after all rounds and a claims window, returns unused collateral/reserve exactly per the written rule.
+
+Use timestamps only for coarse windows and permit early payment. State transitions must be idempotent/safely reject repeats. A fixed twelve-member loop is bounded and acceptable.
+
+USDC approval is not guaranteed collection: a user can revoke it or lack balance. Permit/allowance lets a keeper attempt collection; it cannot make an unfunded wallet pay. Default settlement must remain correct.
+
+## Unattended operation
+
+Permissionless settlement is the liveness mechanism. Any member, recipient, or keeper should call `settleRound`; the recipient has an incentive even if automation fails. Two independent automation paths may call the same public function, with funded gas balances and alerts, but neither needs special payout authority. A multisig may hold only narrow, time-locked pause/recovery authority; it must not reorder recipients or move pots.
+
+Never depend on a frontend, cron job, one server, one builder EOA, or an owner-only keeper. Automation cannot bypass access control, repair insolvency, or pull from an unapproved/unfunded wallet.
+
+## Six-week go/no-go for existing circles
+
+| Check | Pass condition | Failure / action |
+| --- | --- | --- |
+| Access | Unrelated address can settle after deadline; recipient can claim | Owner-only transition stalls; arrange tested authorized operator or migrate/redeploy |
+| Calendar | Current round and next six weeks fall in valid payment/deadline windows | Bad/uninitialized timing can lock flow; use authorized recovery before departure |
+| Solvency | USDC balance plus reserve covers each due $1,200 pot | Fund shortfall or invoke documented default rule; keeper cannot fix it |
+| Collection/default | Every due is paid, or allowance+balance exist; failed collection settles deterministically | Contact member or use real collateral/default path |
+| Automation | At least one keeper has correct address/ABI, funds, and a successful test transaction | No scheduled call; rely on public settlement plus a volunteer |
+| Control | Pause/upgrade is reachable multisig; no travel-dependent single key | Move/confirm authority before leaving |
+| Alerts | Monitor deadlines, failed jobs, `RoundSettled`, and low reserve | Problems may outlive grace period unnoticed |
+
+Rehearse on a fork/testnet from present state: a non-owner pays; after deadline a non-owner settles; simulate a missed payment; prove reserve fills exactly its defined shortfall; prove recipient gets exactly $1,200; then simulate keeper failure and use the public fallback.
+
+## Recommendation
+
+Do not promise unattended continuity until every check passes. If public settlement and viable reserve already exist, fund/test automation, notify members of payment dates and the public fallback, and alert remotely. If a critical transition is owner-only, arrange an authorized operator, pause new circles, or redeploy/migrate before the next deadline.
+
+Obtain jurisdiction-specific legal review of pooled funds/custody, defaults, sanctions/KYC, and consumer disclosures before launch; those rules may constrain the administrator and recovery design.

codex
Wrote [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200254Z-codex-no-skill-2/workspace/plan.md).

Key answer: contracts don’t self-execute; owner-only transitions stall. Includes permissionless settlement design, collateral flaw, keeper fallback, and six-week go/no-go checklist.
diff --git a/artifacts/ship-quiz-003/2026-07-30T200254Z-codex-no-skill-2/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200254Z-codex-no-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..86fecd98060cbc9b43d8384a58caaecaac0dba45
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200254Z-codex-no-skill-2/workspace/plan.md
@@ -0,0 +1,62 @@
+# Susu contract and unattended-operation plan
+
+## Answer
+
+The chain preserves state but never wakes itself up. A transaction is required to record a payment, declare a missed payment, advance a round, or transfer a pot. Therefore existing circles keep operating for the six weeks only if their deployed contracts already permit an independent caller to perform every such transition, and someone/automation is funded to call them. An owner-only `advance`, `declareDefault`, or `payout` stalls at its next required transition.
+
+No deployed address or ABI was provided, so the status of current circles cannot be confirmed from this brief. Check each address against the go/no-go list before leaving.
+
+## First resolve the economics
+
+"Earlier contributions cover the shortfall" is not automatically possible: earlier $100 payments have normally been sent in earlier pots, so cannot also cover a new missed $100. A member who has already received $1,200 also has no remaining turn to forfeit. And if an unpaid member loses a fixed slot, the product must say whether that slot is skipped, reassigned, or paid from reserve.
+
+For guaranteed $1,200 pots, choose one model explicitly:
+
+- Best: escrow each member's full annual commitment ($1,200 USDC) at creation, then release one $1,200 pot per month. Failure to fund means no admission; there is no later collection default.
+- If monthly payments are essential: lock separate liquid collateral/reserve. To guarantee all later pots after an early payout, collateral must cover a member's remaining unpaid instalments. A $100 bond only covers one missed month.
+
+The design below assumes monthly payments plus sufficient locked collateral. Do not label already distributed funds as a reserve.
+
+## Contract design
+
+Deploy one immutable `SusuCircle` per group (or a factory/proxy), with fixed constructor parameters: approved USDC address and on-chain `decimals()`, twelve unique member addresses, fixed payout slots, `startAt`, period, payment window, deadline/grace period, collateral/default rule, and a capped successful-settlement reward. Calculate `monthlyDue = 100 * 10**decimals`; do not assume every supported token has six decimals.
+
+Store `round`, `paid[round][member]`, `memberStatus` (`active`, `defaulted`, `paidOut`), `lockedCollateral`, `reserve`, and `settled[round]`. Emit funding, payment, default, settlement, payout, and collateral-release events. Use `SafeERC20`, reentrancy protection, checks-effects-interactions, and reject fee-on-transfer tokens. Support only the selected USDC.
+
+Required functions:
+
+1. `joinAndFund`: only the precommitted member, pulls required collateral with approval or permit.
+2. `pay(round)`: only during that round's payment window; pulls one due and records it.
+3. `settleRound(round)`: callable by **any address** after deadline; marks unpaid members defaulted, moves only locked collateral to reserve, selects recipient by the disclosed slot rule, and pays the caller reward only on success. It must revert if the reserve cannot make the pot whole; that is an honest insolvency state.
+4. `claimPot(round)`: selected recipient claims, or settlement transfers atomically, only once accounting proves $1,200 is available.
+5. `finalize`: after all rounds and a claims window, returns unused collateral/reserve exactly per the written rule.
+
+Use timestamps only for coarse windows and permit early payment. State transitions must be idempotent/safely reject repeats. A fixed twelve-member loop is bounded and acceptable.
+
+USDC approval is not guaranteed collection: a user can revoke it or lack balance. Permit/allowance lets a keeper attempt collection; it cannot make an unfunded wallet pay. Default settlement must remain correct.
+
+## Unattended operation
+
+Permissionless settlement is the liveness mechanism. Any member, recipient, or keeper should call `settleRound`; the recipient has an incentive even if automation fails. Two independent automation paths may call the same public function, with funded gas balances and alerts, but neither needs special payout authority. A multisig may hold only narrow, time-locked pause/recovery authority; it must not reorder recipients or move pots.
+
+Never depend on a frontend, cron job, one server, one builder EOA, or an owner-only keeper. Automation cannot bypass access control, repair insolvency, or pull from an unapproved/unfunded wallet.
+
+## Six-week go/no-go for existing circles
+
+| Check | Pass condition | Failure / action |
+| --- | --- | --- |
+| Access | Unrelated address can settle after deadline; recipient can claim | Owner-only transition stalls; arrange tested authorized operator or migrate/redeploy |
+| Calendar | Current round and next six weeks fall in valid payment/deadline windows | Bad/uninitialized timing can lock flow; use authorized recovery before departure |
+| Solvency | USDC balance plus reserve covers each due $1,200 pot | Fund shortfall or invoke documented default rule; keeper cannot fix it |
+| Collection/default | Every due is paid, or allowance+balance exist; failed collection settles deterministically | Contact member or use real collateral/default path |
+| Automation | At least one keeper has correct address/ABI, funds, and a successful test transaction | No scheduled call; rely on public settlement plus a volunteer |
+| Control | Pause/upgrade is reachable multisig; no travel-dependent single key | Move/confirm authority before leaving |
+| Alerts | Monitor deadlines, failed jobs, `RoundSettled`, and low reserve | Problems may outlive grace period unnoticed |
+
+Rehearse on a fork/testnet from present state: a non-owner pays; after deadline a non-owner settles; simulate a missed payment; prove reserve fills exactly its defined shortfall; prove recipient gets exactly $1,200; then simulate keeper failure and use the public fallback.
+
+## Recommendation
+
+Do not promise unattended continuity until every check passes. If public settlement and viable reserve already exist, fund/test automation, notify members of payment dates and the public fallback, and alert remotely. If a critical transition is owner-only, arrange an authorized operator, pause new circles, or redeploy/migrate before the next deadline.
+
+Obtain jurisdiction-specific legal review of pooled funds/custody, defaults, sanctions/KYC, and consumer disclosures before launch; those rules may constrain the administrator and recovery design.

tokens used
23,372
Wrote [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200254Z-codex-no-skill-2/workspace/plan.md).

Key answer: contracts don’t self-execute; owner-only transitions stall. Includes permissionless settlement design, collateral flaw, keeper fallback, and six-week go/no-go checklist.
