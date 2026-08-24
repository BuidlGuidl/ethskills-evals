Reading additional input from stdin...
OpenAI Codex v0.146.0
--------
workdir: /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: high
reasoning summaries: none
session id: 019fb4a1-5a84-7b52-9d69-629b649bd8dd
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
I’ll inspect the workspace, then write a concise contract design and liveness analysis to `plan.md`.
exec
/bin/bash -lc "pwd && rg --files -g '"'!*node_modules*'"' -g '"'!*.lock'"' | head -200" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace
 succeeded in 0ms:
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace
TASK.md

exec
/bin/bash -lc "sed -n '1,240p' TASK.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace
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

codex
The key constraint is liveness: timestamps can make a round eligible, but cannot collect USDC, declare a default, or send a payout by themselves. I’m also accounting for the missing-payment rule with real escrowed funds, not just an internal balance.
apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md
diff --git a/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..768c97b205012e1fd08da1de324d7479ed87a6a5
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,105 @@
+# Susu contract and absence plan
+
+## Design
+
+Deploy one immutable `Circle` per group (a factory may deploy them).  Its
+constructor records the USDC address, 12 member addresses, the immutable
+recipient order, `100e6` USDC per epoch, the start time, and the epoch/cutoff
+schedule.  Use an allowlisted USDC deployment and `SafeERC20`; USDC has six
+decimals.  Reject duplicate members and recipient slots.
+
+The circle should be a small state machine:
+
+```text
+Funding (before cutoff) -> Settleable (after cutoff) -> Paid(round + 1)
+```
+
+* `pay(round)` is callable by a member before that round's cutoff and pulls
+  exactly $100 from them into the circle.  A member can pay early for several
+  rounds if desired.
+* `settle(round)` is callable by **any address** after the cutoff, exactly
+  once.  It marks each unpaid member defaulted, transfers the round's $1,200
+  to the scheduled active recipient, emits `RoundSettled`, and opens the next
+  round.  With only 12 members, iterating the fixed member array is bounded.
+* A default is permanent: it cancels the member's unpaid recipient slot and
+  prevents future participation.  The contract needs an explicit rule for a
+  defaulted member's scheduled payout slot--e.g. skip that epoch and retain
+  the funds for final pro-rata refund to non-defaulted members.  Do not leave
+  this as an operator decision.
+* Expose read-only `roundStatus`, `amountDue`, `cutoff`, and `canSettle`, so a
+  UI, keeper, or anyone else can operate and monitor the same rules.
+
+Use checks-effects-interactions, a reentrancy guard around USDC transfers,
+fixed addresses/amounts, and no upgrade or owner-only round-advance function.
+An emergency pause should be narrowly scoped, held by a 2-of-3 multisig with
+an independent signer; it must not be required for ordinary settlement.
+
+## The funding issue in the stated rule
+
+"Earlier contributions cover the shortfall" is not automatically true.  If
+earlier monthly payments have already been sent to earlier recipients, those
+USDC are no longer in the contract.  An accounting `contributed` number cannot
+pay this month's recipient.
+
+To guarantee a $1,200 payout despite any missed payment, require liquid
+collateral.  The simple version is a $1,200 USDC bond per member at join:
+
+* each epoch debits $100 from each active member's escrowed balance into the
+  payout pot;
+* a member must top up before the cutoff to keep their balance funded;
+* if they do not, mark them defaulted and use their remaining bond for the
+  current and remaining $100 obligations; their scheduled payout is forfeited.
+
+This is fully funded from day one, so a member who later stops topping up
+cannot create an unfunded promised pot.  A lower bond is possible only if an
+explicit, solvent reserve/credit facility covers the missing future payments;
+otherwise the promise to pay $1,200 is false.  The product also needs a
+written policy for insolvency/multiple defaults, final surplus, and what
+members who default before their turn receive (normally nothing beyond any
+defined refundable excess bond).
+
+If the intended product instead accepts that a missed payment makes the pot
+smaller, say that directly and pay the actual balance.  It cannot both pay the
+full pot and rely on funds already paid out without collateral.
+
+## Will existing circles run during our six-week absence?
+
+Not merely because the contract is deployed.  A contract does not wake up at a
+timestamp.  During six weeks, two monthly cutoffs may pass; without a
+transaction, no payment is pulled, no missed payment is recorded, no payout
+is transferred, and the next round remains blocked.  A deadline based on
+`block.timestamp` only lets a later caller prove that settlement is allowed.
+
+They keep working while we are away only if all ordinary paths are already
+permissionless and someone submits the required transactions.  In particular:
+
+| Dependency | What breaks if absent | Required mitigation |
+| --- | --- | --- |
+| Members | USDC cannot be taken from a wallet without prior allowance/permit and sufficient balance | Require/prompt funding before cutoff; preferably keep the collateral in escrow. |
+| Settlement caller | Due rounds stay pending; no recipient is paid | Make `settle` public, pay a small fixed keeper bounty from a funded fee reserve, and register independent automation/monitoring. |
+| Builder/admin key | Any owner-only default, payout, or advance function cannot run | Remove it from normal flow; otherwise delegate it to an independent multisig/operator before leaving. |
+| Automation service | Its job may fail, pause, run out of gas/fees, or be discontinued | Use more than one keeper/monitor, alerts, and keep public manual `settle` as the fallback. |
+| Emergency authority | A real exploit or USDC issue cannot be responded to | Pre-agree a multisig emergency runbook; do not give it arbitrary payout powers. |
+
+## Before leaving
+
+1. Verify every live circle has its exact epoch schedule, correct USDC,
+   immutable order, sufficient escrow/reserve, and no owner-only normal-path
+   action.
+2. Fund at least two settlement bounties/transaction fee budgets, register two
+   independent keeper paths, and test them on a live-like circle.  A keeper is
+   a trigger, not a source of funds.
+3. Test the failure paths: unpaid member before their turn, after their turn,
+   an unpaid scheduled recipient, retry after a failed USDC transfer, and a
+   missed keeper run.  Confirm exactly one payout per eligible epoch.
+4. Give members clear cutoff notices and verify their allowance/escrow balance
+   now.  A keeper cannot repair a member's revoked allowance or empty wallet.
+5. Put monitoring and an escalation contact outside the two-person team.  The
+   public `settle` function means any participant can recover a missed keeper
+   run without privileged access.
+
+Until those conditions are true, the honest answer is **no**: existing circles
+are operationally dependent on us (or another transaction sender) and can
+stall at the first unattended cutoff.  No contract change can retroactively
+create collateral for an already undercollateralized circle; it needs a
+member-approved top-up/reserve, or its rules must allow a reduced payout.

diff --git a/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..768c97b205012e1fd08da1de324d7479ed87a6a5
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,105 @@
+# Susu contract and absence plan
+
+## Design
+
+Deploy one immutable `Circle` per group (a factory may deploy them).  Its
+constructor records the USDC address, 12 member addresses, the immutable
+recipient order, `100e6` USDC per epoch, the start time, and the epoch/cutoff
+schedule.  Use an allowlisted USDC deployment and `SafeERC20`; USDC has six
+decimals.  Reject duplicate members and recipient slots.
+
+The circle should be a small state machine:
+
+```text
+Funding (before cutoff) -> Settleable (after cutoff) -> Paid(round + 1)
+```
+
+* `pay(round)` is callable by a member before that round's cutoff and pulls
+  exactly $100 from them into the circle.  A member can pay early for several
+  rounds if desired.
+* `settle(round)` is callable by **any address** after the cutoff, exactly
+  once.  It marks each unpaid member defaulted, transfers the round's $1,200
+  to the scheduled active recipient, emits `RoundSettled`, and opens the next
+  round.  With only 12 members, iterating the fixed member array is bounded.
+* A default is permanent: it cancels the member's unpaid recipient slot and
+  prevents future participation.  The contract needs an explicit rule for a
+  defaulted member's scheduled payout slot--e.g. skip that epoch and retain
+  the funds for final pro-rata refund to non-defaulted members.  Do not leave
+  this as an operator decision.
+* Expose read-only `roundStatus`, `amountDue`, `cutoff`, and `canSettle`, so a
+  UI, keeper, or anyone else can operate and monitor the same rules.
+
+Use checks-effects-interactions, a reentrancy guard around USDC transfers,
+fixed addresses/amounts, and no upgrade or owner-only round-advance function.
+An emergency pause should be narrowly scoped, held by a 2-of-3 multisig with
+an independent signer; it must not be required for ordinary settlement.
+
+## The funding issue in the stated rule
+
+"Earlier contributions cover the shortfall" is not automatically true.  If
+earlier monthly payments have already been sent to earlier recipients, those
+USDC are no longer in the contract.  An accounting `contributed` number cannot
+pay this month's recipient.
+
+To guarantee a $1,200 payout despite any missed payment, require liquid
+collateral.  The simple version is a $1,200 USDC bond per member at join:
+
+* each epoch debits $100 from each active member's escrowed balance into the
+  payout pot;
+* a member must top up before the cutoff to keep their balance funded;
+* if they do not, mark them defaulted and use their remaining bond for the
+  current and remaining $100 obligations; their scheduled payout is forfeited.
+
+This is fully funded from day one, so a member who later stops topping up
+cannot create an unfunded promised pot.  A lower bond is possible only if an
+explicit, solvent reserve/credit facility covers the missing future payments;
+otherwise the promise to pay $1,200 is false.  The product also needs a
+written policy for insolvency/multiple defaults, final surplus, and what
+members who default before their turn receive (normally nothing beyond any
+defined refundable excess bond).
+
+If the intended product instead accepts that a missed payment makes the pot
+smaller, say that directly and pay the actual balance.  It cannot both pay the
+full pot and rely on funds already paid out without collateral.
+
+## Will existing circles run during our six-week absence?
+
+Not merely because the contract is deployed.  A contract does not wake up at a
+timestamp.  During six weeks, two monthly cutoffs may pass; without a
+transaction, no payment is pulled, no missed payment is recorded, no payout
+is transferred, and the next round remains blocked.  A deadline based on
+`block.timestamp` only lets a later caller prove that settlement is allowed.
+
+They keep working while we are away only if all ordinary paths are already
+permissionless and someone submits the required transactions.  In particular:
+
+| Dependency | What breaks if absent | Required mitigation |
+| --- | --- | --- |
+| Members | USDC cannot be taken from a wallet without prior allowance/permit and sufficient balance | Require/prompt funding before cutoff; preferably keep the collateral in escrow. |
+| Settlement caller | Due rounds stay pending; no recipient is paid | Make `settle` public, pay a small fixed keeper bounty from a funded fee reserve, and register independent automation/monitoring. |
+| Builder/admin key | Any owner-only default, payout, or advance function cannot run | Remove it from normal flow; otherwise delegate it to an independent multisig/operator before leaving. |
+| Automation service | Its job may fail, pause, run out of gas/fees, or be discontinued | Use more than one keeper/monitor, alerts, and keep public manual `settle` as the fallback. |
+| Emergency authority | A real exploit or USDC issue cannot be responded to | Pre-agree a multisig emergency runbook; do not give it arbitrary payout powers. |
+
+## Before leaving
+
+1. Verify every live circle has its exact epoch schedule, correct USDC,
+   immutable order, sufficient escrow/reserve, and no owner-only normal-path
+   action.
+2. Fund at least two settlement bounties/transaction fee budgets, register two
+   independent keeper paths, and test them on a live-like circle.  A keeper is
+   a trigger, not a source of funds.
+3. Test the failure paths: unpaid member before their turn, after their turn,
+   an unpaid scheduled recipient, retry after a failed USDC transfer, and a
+   missed keeper run.  Confirm exactly one payout per eligible epoch.
+4. Give members clear cutoff notices and verify their allowance/escrow balance
+   now.  A keeper cannot repair a member's revoked allowance or empty wallet.
+5. Put monitoring and an escalation contact outside the two-person team.  The
+   public `settle` function means any participant can recover a missed keeper
+   run without privileged access.
+
+Until those conditions are true, the honest answer is **no**: existing circles
+are operationally dependent on us (or another transaction sender) and can
+stall at the first unattended cutoff.  No contract change can retroactively
+create collateral for an already undercollateralized circle; it needs a
+member-approved top-up/reserve, or its rules must allow a reduced payout.

apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md
diff --git a/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..6b42b0749e4617620f747a74f1477cb1f4ec27bd
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,110 @@
+# Susu contract and absence plan
+
+## Design
+
+Deploy one immutable `Circle` per group (a factory may deploy them).  Its
+constructor records the USDC address, 12 member addresses, the immutable
+recipient order, `100e6` USDC per epoch, the start time, and the epoch/cutoff
+schedule.  Use an allowlisted USDC deployment and `SafeERC20`; USDC has six
+decimals.  Reject duplicate members and recipient slots.
+
+The circle should be a small state machine:
+
+```text
+Funding (before cutoff) -> Settleable (after cutoff) -> Paid(round + 1)
+```
+
+* At join, each member escrows a refundable $1,200 performance bond.  Then
+  `pay(round)` is callable by a member before that round's cutoff and pulls
+  exactly $100 from them into the circle.  A member can pay early for several
+  rounds if desired.
+* `settle(round)` is callable by **any address** after the cutoff, exactly
+  once.  For each unpaid member it permanently marks defaulted and moves $100
+  from that member's bond into the pot; paid members' $100 is already there.
+  It then transfers the $1,200 pot to that round's scheduled recipient, if
+  that recipient has not defaulted, emits `RoundSettled`, and opens the next
+  round.  With only 12 members, iterating the fixed member array is bounded.
+* A default is permanent: it cancels the member's unpaid recipient slot and
+  prevents future participation.  The contract needs an explicit rule for a
+  defaulted member's scheduled payout slot--e.g. skip that epoch and retain
+  the funds for final pro-rata refund to non-defaulted members.  Do not leave
+  this as an operator decision.
+* Expose read-only `roundStatus`, `amountDue`, `cutoff`, and `canSettle`, so a
+  UI, keeper, or anyone else can operate and monitor the same rules.
+
+Use checks-effects-interactions, a reentrancy guard around USDC transfers,
+fixed addresses/amounts, and no upgrade or owner-only round-advance function.
+An emergency pause should be narrowly scoped, held by a 2-of-3 multisig with
+an independent signer; it must not be required for ordinary settlement.
+
+## The funding issue in the stated rule
+
+"Earlier contributions cover the shortfall" is not automatically true. If
+earlier monthly payments have already been sent to earlier recipients, those
+USDC are no longer in the contract. An accounting `contributed` number cannot
+pay this month's recipient.
+
+To guarantee a $1,200 payout despite any missed payment, require liquid
+collateral. The simple version is a $1,200 USDC bond per member at join,
+separate from the monthly $100 payment:
+
+* timely payments form the normal payout pot;
+* on the first missed payment, slash $100 from that member's bond into that
+  pot and reserve $100 from the same bond for each remaining epoch;
+* the defaulted member's scheduled payout is forfeited; return only the
+  explicitly defined unused bond amount (the safest policy is to distribute
+  all forfeited bond only at close).
+
+The default backstop is fully funded from day one, so a member who later stops
+paying cannot create an unfunded promised pot. A lower bond is possible only if an
+explicit, solvent reserve/credit facility covers the missing future payments;
+otherwise the promise to pay $1,200 is false.  The product also needs a
+written policy for insolvency/multiple defaults, final surplus, and what
+members who default before their turn receive (normally nothing beyond any
+defined refundable excess bond).
+
+If the intended product instead accepts that a missed payment makes the pot
+smaller, say that directly and pay the actual balance.  It cannot both pay the
+full pot and rely on funds already paid out without collateral.
+
+## Will existing circles run during our six-week absence?
+
+Not merely because the contract is deployed.  A contract does not wake up at a
+timestamp.  During six weeks, two monthly cutoffs may pass; without a
+transaction, no payment is pulled, no missed payment is recorded, no payout
+is transferred, and the next round remains blocked.  A deadline based on
+`block.timestamp` only lets a later caller prove that settlement is allowed.
+
+They keep working while we are away only if all ordinary paths are already
+permissionless and someone submits the required transactions.  In particular:
+
+| Dependency | What breaks if absent | Required mitigation |
+| --- | --- | --- |
+| Members | USDC cannot be taken from a wallet without prior allowance/permit and sufficient balance | Require/prompt funding before cutoff; preferably keep the collateral in escrow. |
+| Settlement caller | Due rounds stay pending; no recipient is paid | Make `settle` public, pay a small fixed keeper bounty from a funded fee reserve, and register independent automation/monitoring. |
+| Builder/admin key | Any owner-only default, payout, or advance function cannot run | Remove it from normal flow; otherwise delegate it to an independent multisig/operator before leaving. |
+| Automation service | Its job may fail, pause, run out of gas/fees, or be discontinued | Use more than one keeper/monitor, alerts, and keep public manual `settle` as the fallback. |
+| Emergency authority | A real exploit or USDC issue cannot be responded to | Pre-agree a multisig emergency runbook; do not give it arbitrary payout powers. |
+
+## Before leaving
+
+1. Verify every live circle has its exact epoch schedule, correct USDC,
+   immutable order, sufficient escrow/reserve, and no owner-only normal-path
+   action.
+2. Fund at least two settlement bounties/transaction fee budgets, register two
+   independent keeper paths, and test them on a live-like circle.  A keeper is
+   a trigger, not a source of funds.
+3. Test the failure paths: unpaid member before their turn, after their turn,
+   an unpaid scheduled recipient, retry after a failed USDC transfer, and a
+   missed keeper run.  Confirm exactly one payout per eligible epoch.
+4. Give members clear cutoff notices and verify their allowance/escrow balance
+   now.  A keeper cannot repair a member's revoked allowance or empty wallet.
+5. Put monitoring and an escalation contact outside the two-person team.  The
+   public `settle` function means any participant can recover a missed keeper
+   run without privileged access.
+
+Until those conditions are true, the honest answer is **no**: existing circles
+are operationally dependent on us (or another transaction sender) and can
+stall at the first unattended cutoff.  No contract change can retroactively
+create collateral for an already undercollateralized circle; it needs a
+member-approved top-up/reserve, or its rules must allow a reduced payout.

diff --git a/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..6b42b0749e4617620f747a74f1477cb1f4ec27bd
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,110 @@
+# Susu contract and absence plan
+
+## Design
+
+Deploy one immutable `Circle` per group (a factory may deploy them).  Its
+constructor records the USDC address, 12 member addresses, the immutable
+recipient order, `100e6` USDC per epoch, the start time, and the epoch/cutoff
+schedule.  Use an allowlisted USDC deployment and `SafeERC20`; USDC has six
+decimals.  Reject duplicate members and recipient slots.
+
+The circle should be a small state machine:
+
+```text
+Funding (before cutoff) -> Settleable (after cutoff) -> Paid(round + 1)
+```
+
+* At join, each member escrows a refundable $1,200 performance bond.  Then
+  `pay(round)` is callable by a member before that round's cutoff and pulls
+  exactly $100 from them into the circle.  A member can pay early for several
+  rounds if desired.
+* `settle(round)` is callable by **any address** after the cutoff, exactly
+  once.  For each unpaid member it permanently marks defaulted and moves $100
+  from that member's bond into the pot; paid members' $100 is already there.
+  It then transfers the $1,200 pot to that round's scheduled recipient, if
+  that recipient has not defaulted, emits `RoundSettled`, and opens the next
+  round.  With only 12 members, iterating the fixed member array is bounded.
+* A default is permanent: it cancels the member's unpaid recipient slot and
+  prevents future participation.  The contract needs an explicit rule for a
+  defaulted member's scheduled payout slot--e.g. skip that epoch and retain
+  the funds for final pro-rata refund to non-defaulted members.  Do not leave
+  this as an operator decision.
+* Expose read-only `roundStatus`, `amountDue`, `cutoff`, and `canSettle`, so a
+  UI, keeper, or anyone else can operate and monitor the same rules.
+
+Use checks-effects-interactions, a reentrancy guard around USDC transfers,
+fixed addresses/amounts, and no upgrade or owner-only round-advance function.
+An emergency pause should be narrowly scoped, held by a 2-of-3 multisig with
+an independent signer; it must not be required for ordinary settlement.
+
+## The funding issue in the stated rule
+
+"Earlier contributions cover the shortfall" is not automatically true. If
+earlier monthly payments have already been sent to earlier recipients, those
+USDC are no longer in the contract. An accounting `contributed` number cannot
+pay this month's recipient.
+
+To guarantee a $1,200 payout despite any missed payment, require liquid
+collateral. The simple version is a $1,200 USDC bond per member at join,
+separate from the monthly $100 payment:
+
+* timely payments form the normal payout pot;
+* on the first missed payment, slash $100 from that member's bond into that
+  pot and reserve $100 from the same bond for each remaining epoch;
+* the defaulted member's scheduled payout is forfeited; return only the
+  explicitly defined unused bond amount (the safest policy is to distribute
+  all forfeited bond only at close).
+
+The default backstop is fully funded from day one, so a member who later stops
+paying cannot create an unfunded promised pot. A lower bond is possible only if an
+explicit, solvent reserve/credit facility covers the missing future payments;
+otherwise the promise to pay $1,200 is false.  The product also needs a
+written policy for insolvency/multiple defaults, final surplus, and what
+members who default before their turn receive (normally nothing beyond any
+defined refundable excess bond).
+
+If the intended product instead accepts that a missed payment makes the pot
+smaller, say that directly and pay the actual balance.  It cannot both pay the
+full pot and rely on funds already paid out without collateral.
+
+## Will existing circles run during our six-week absence?
+
+Not merely because the contract is deployed.  A contract does not wake up at a
+timestamp.  During six weeks, two monthly cutoffs may pass; without a
+transaction, no payment is pulled, no missed payment is recorded, no payout
+is transferred, and the next round remains blocked.  A deadline based on
+`block.timestamp` only lets a later caller prove that settlement is allowed.
+
+They keep working while we are away only if all ordinary paths are already
+permissionless and someone submits the required transactions.  In particular:
+
+| Dependency | What breaks if absent | Required mitigation |
+| --- | --- | --- |
+| Members | USDC cannot be taken from a wallet without prior allowance/permit and sufficient balance | Require/prompt funding before cutoff; preferably keep the collateral in escrow. |
+| Settlement caller | Due rounds stay pending; no recipient is paid | Make `settle` public, pay a small fixed keeper bounty from a funded fee reserve, and register independent automation/monitoring. |
+| Builder/admin key | Any owner-only default, payout, or advance function cannot run | Remove it from normal flow; otherwise delegate it to an independent multisig/operator before leaving. |
+| Automation service | Its job may fail, pause, run out of gas/fees, or be discontinued | Use more than one keeper/monitor, alerts, and keep public manual `settle` as the fallback. |
+| Emergency authority | A real exploit or USDC issue cannot be responded to | Pre-agree a multisig emergency runbook; do not give it arbitrary payout powers. |
+
+## Before leaving
+
+1. Verify every live circle has its exact epoch schedule, correct USDC,
+   immutable order, sufficient escrow/reserve, and no owner-only normal-path
+   action.
+2. Fund at least two settlement bounties/transaction fee budgets, register two
+   independent keeper paths, and test them on a live-like circle.  A keeper is
+   a trigger, not a source of funds.
+3. Test the failure paths: unpaid member before their turn, after their turn,
+   an unpaid scheduled recipient, retry after a failed USDC transfer, and a
+   missed keeper run.  Confirm exactly one payout per eligible epoch.
+4. Give members clear cutoff notices and verify their allowance/escrow balance
+   now.  A keeper cannot repair a member's revoked allowance or empty wallet.
+5. Put monitoring and an escalation contact outside the two-person team.  The
+   public `settle` function means any participant can recover a missed keeper
+   run without privileged access.
+
+Until those conditions are true, the honest answer is **no**: existing circles
+are operationally dependent on us (or another transaction sender) and can
+stall at the first unattended cutoff.  No contract change can retroactively
+create collateral for an already undercollateralized circle; it needs a
+member-approved top-up/reserve, or its rules must allow a reduced payout.

exec
/bin/bash -lc "sed -n '1,260p' plan.md && git diff --check" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace
 succeeded in 0ms:
# Susu contract and absence plan

## Design

Deploy one immutable `Circle` per group (a factory may deploy them).  Its
constructor records the USDC address, 12 member addresses, the immutable
recipient order, `100e6` USDC per epoch, the start time, and the epoch/cutoff
schedule.  Use an allowlisted USDC deployment and `SafeERC20`; USDC has six
decimals.  Reject duplicate members and recipient slots.

The circle should be a small state machine:

```text
Funding (before cutoff) -> Settleable (after cutoff) -> Paid(round + 1)
```

* At join, each member escrows a refundable $1,200 performance bond.  Then
  `pay(round)` is callable by a member before that round's cutoff and pulls
  exactly $100 from them into the circle.  A member can pay early for several
  rounds if desired.
* `settle(round)` is callable by **any address** after the cutoff, exactly
  once.  For each unpaid member it permanently marks defaulted and moves $100
  from that member's bond into the pot; paid members' $100 is already there.
  It then transfers the $1,200 pot to that round's scheduled recipient, if
  that recipient has not defaulted, emits `RoundSettled`, and opens the next
  round.  With only 12 members, iterating the fixed member array is bounded.
* A default is permanent: it cancels the member's unpaid recipient slot and
  prevents future participation.  The contract needs an explicit rule for a
  defaulted member's scheduled payout slot--e.g. skip that epoch and retain
  the funds for final pro-rata refund to non-defaulted members.  Do not leave
  this as an operator decision.
* Expose read-only `roundStatus`, `amountDue`, `cutoff`, and `canSettle`, so a
  UI, keeper, or anyone else can operate and monitor the same rules.

Use checks-effects-interactions, a reentrancy guard around USDC transfers,
fixed addresses/amounts, and no upgrade or owner-only round-advance function.
An emergency pause should be narrowly scoped, held by a 2-of-3 multisig with
an independent signer; it must not be required for ordinary settlement.

## The funding issue in the stated rule

"Earlier contributions cover the shortfall" is not automatically true. If
earlier monthly payments have already been sent to earlier recipients, those
USDC are no longer in the contract. An accounting `contributed` number cannot
pay this month's recipient.

To guarantee a $1,200 payout despite any missed payment, require liquid
collateral. The simple version is a $1,200 USDC bond per member at join,
separate from the monthly $100 payment:

* timely payments form the normal payout pot;
* on the first missed payment, slash $100 from that member's bond into that
  pot and reserve $100 from the same bond for each remaining epoch;
* the defaulted member's scheduled payout is forfeited; return only the
  explicitly defined unused bond amount (the safest policy is to distribute
  all forfeited bond only at close).

The default backstop is fully funded from day one, so a member who later stops
paying cannot create an unfunded promised pot. A lower bond is possible only if an
explicit, solvent reserve/credit facility covers the missing future payments;
otherwise the promise to pay $1,200 is false.  The product also needs a
written policy for insolvency/multiple defaults, final surplus, and what
members who default before their turn receive (normally nothing beyond any
defined refundable excess bond).

If the intended product instead accepts that a missed payment makes the pot
smaller, say that directly and pay the actual balance.  It cannot both pay the
full pot and rely on funds already paid out without collateral.

## Will existing circles run during our six-week absence?

Not merely because the contract is deployed.  A contract does not wake up at a
timestamp.  During six weeks, two monthly cutoffs may pass; without a
transaction, no payment is pulled, no missed payment is recorded, no payout
is transferred, and the next round remains blocked.  A deadline based on
`block.timestamp` only lets a later caller prove that settlement is allowed.

They keep working while we are away only if all ordinary paths are already
permissionless and someone submits the required transactions.  In particular:

| Dependency | What breaks if absent | Required mitigation |
| --- | --- | --- |
| Members | USDC cannot be taken from a wallet without prior allowance/permit and sufficient balance | Require/prompt funding before cutoff; preferably keep the collateral in escrow. |
| Settlement caller | Due rounds stay pending; no recipient is paid | Make `settle` public, pay a small fixed keeper bounty from a funded fee reserve, and register independent automation/monitoring. |
| Builder/admin key | Any owner-only default, payout, or advance function cannot run | Remove it from normal flow; otherwise delegate it to an independent multisig/operator before leaving. |
| Automation service | Its job may fail, pause, run out of gas/fees, or be discontinued | Use more than one keeper/monitor, alerts, and keep public manual `settle` as the fallback. |
| Emergency authority | A real exploit or USDC issue cannot be responded to | Pre-agree a multisig emergency runbook; do not give it arbitrary payout powers. |

## Before leaving

1. Verify every live circle has its exact epoch schedule, correct USDC,
   immutable order, sufficient escrow/reserve, and no owner-only normal-path
   action.
2. Fund at least two settlement bounties/transaction fee budgets, register two
   independent keeper paths, and test them on a live-like circle.  A keeper is
   a trigger, not a source of funds.
3. Test the failure paths: unpaid member before their turn, after their turn,
   an unpaid scheduled recipient, retry after a failed USDC transfer, and a
   missed keeper run.  Confirm exactly one payout per eligible epoch.
4. Give members clear cutoff notices and verify their allowance/escrow balance
   now.  A keeper cannot repair a member's revoked allowance or empty wallet.
5. Put monitoring and an escalation contact outside the two-person team.  The
   public `settle` function means any participant can recover a missed keeper
   run without privileged access.

Until those conditions are true, the honest answer is **no**: existing circles
are operationally dependent on us (or another transaction sender) and can
stall at the first unattended cutoff.  No contract change can retroactively
create collateral for an already undercollateralized circle; it needs a
member-approved top-up/reserve, or its rules must allow a reduced payout.

diff --git a/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..6b42b0749e4617620f747a74f1477cb1f4ec27bd
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,110 @@
+# Susu contract and absence plan
+
+## Design
+
+Deploy one immutable `Circle` per group (a factory may deploy them).  Its
+constructor records the USDC address, 12 member addresses, the immutable
+recipient order, `100e6` USDC per epoch, the start time, and the epoch/cutoff
+schedule.  Use an allowlisted USDC deployment and `SafeERC20`; USDC has six
+decimals.  Reject duplicate members and recipient slots.
+
+The circle should be a small state machine:
+
+```text
+Funding (before cutoff) -> Settleable (after cutoff) -> Paid(round + 1)
+```
+
+* At join, each member escrows a refundable $1,200 performance bond.  Then
+  `pay(round)` is callable by a member before that round's cutoff and pulls
+  exactly $100 from them into the circle.  A member can pay early for several
+  rounds if desired.
+* `settle(round)` is callable by **any address** after the cutoff, exactly
+  once.  For each unpaid member it permanently marks defaulted and moves $100
+  from that member's bond into the pot; paid members' $100 is already there.
+  It then transfers the $1,200 pot to that round's scheduled recipient, if
+  that recipient has not defaulted, emits `RoundSettled`, and opens the next
+  round.  With only 12 members, iterating the fixed member array is bounded.
+* A default is permanent: it cancels the member's unpaid recipient slot and
+  prevents future participation.  The contract needs an explicit rule for a
+  defaulted member's scheduled payout slot--e.g. skip that epoch and retain
+  the funds for final pro-rata refund to non-defaulted members.  Do not leave
+  this as an operator decision.
+* Expose read-only `roundStatus`, `amountDue`, `cutoff`, and `canSettle`, so a
+  UI, keeper, or anyone else can operate and monitor the same rules.
+
+Use checks-effects-interactions, a reentrancy guard around USDC transfers,
+fixed addresses/amounts, and no upgrade or owner-only round-advance function.
+An emergency pause should be narrowly scoped, held by a 2-of-3 multisig with
+an independent signer; it must not be required for ordinary settlement.
+
+## The funding issue in the stated rule
+
+"Earlier contributions cover the shortfall" is not automatically true. If
+earlier monthly payments have already been sent to earlier recipients, those
+USDC are no longer in the contract. An accounting `contributed` number cannot
+pay this month's recipient.
+
+To guarantee a $1,200 payout despite any missed payment, require liquid
+collateral. The simple version is a $1,200 USDC bond per member at join,
+separate from the monthly $100 payment:
+
+* timely payments form the normal payout pot;
+* on the first missed payment, slash $100 from that member's bond into that
+  pot and reserve $100 from the same bond for each remaining epoch;
+* the defaulted member's scheduled payout is forfeited; return only the
+  explicitly defined unused bond amount (the safest policy is to distribute
+  all forfeited bond only at close).
+
+The default backstop is fully funded from day one, so a member who later stops
+paying cannot create an unfunded promised pot. A lower bond is possible only if an
+explicit, solvent reserve/credit facility covers the missing future payments;
+otherwise the promise to pay $1,200 is false.  The product also needs a
+written policy for insolvency/multiple defaults, final surplus, and what
+members who default before their turn receive (normally nothing beyond any
+defined refundable excess bond).
+
+If the intended product instead accepts that a missed payment makes the pot
+smaller, say that directly and pay the actual balance.  It cannot both pay the
+full pot and rely on funds already paid out without collateral.
+
+## Will existing circles run during our six-week absence?
+
+Not merely because the contract is deployed.  A contract does not wake up at a
+timestamp.  During six weeks, two monthly cutoffs may pass; without a
+transaction, no payment is pulled, no missed payment is recorded, no payout
+is transferred, and the next round remains blocked.  A deadline based on
+`block.timestamp` only lets a later caller prove that settlement is allowed.
+
+They keep working while we are away only if all ordinary paths are already
+permissionless and someone submits the required transactions.  In particular:
+
+| Dependency | What breaks if absent | Required mitigation |
+| --- | --- | --- |
+| Members | USDC cannot be taken from a wallet without prior allowance/permit and sufficient balance | Require/prompt funding before cutoff; preferably keep the collateral in escrow. |
+| Settlement caller | Due rounds stay pending; no recipient is paid | Make `settle` public, pay a small fixed keeper bounty from a funded fee reserve, and register independent automation/monitoring. |
+| Builder/admin key | Any owner-only default, payout, or advance function cannot run | Remove it from normal flow; otherwise delegate it to an independent multisig/operator before leaving. |
+| Automation service | Its job may fail, pause, run out of gas/fees, or be discontinued | Use more than one keeper/monitor, alerts, and keep public manual `settle` as the fallback. |
+| Emergency authority | A real exploit or USDC issue cannot be responded to | Pre-agree a multisig emergency runbook; do not give it arbitrary payout powers. |
+
+## Before leaving
+
+1. Verify every live circle has its exact epoch schedule, correct USDC,
+   immutable order, sufficient escrow/reserve, and no owner-only normal-path
+   action.
+2. Fund at least two settlement bounties/transaction fee budgets, register two
+   independent keeper paths, and test them on a live-like circle.  A keeper is
+   a trigger, not a source of funds.
+3. Test the failure paths: unpaid member before their turn, after their turn,
+   an unpaid scheduled recipient, retry after a failed USDC transfer, and a
+   missed keeper run.  Confirm exactly one payout per eligible epoch.
+4. Give members clear cutoff notices and verify their allowance/escrow balance
+   now.  A keeper cannot repair a member's revoked allowance or empty wallet.
+5. Put monitoring and an escalation contact outside the two-person team.  The
+   public `settle` function means any participant can recover a missed keeper
+   run without privileged access.
+
+Until those conditions are true, the honest answer is **no**: existing circles
+are operationally dependent on us (or another transaction sender) and can
+stall at the first unattended cutoff.  No contract change can retroactively
+create collateral for an already undercollateralized circle; it needs a
+member-approved top-up/reserve, or its rules must allow a reduced payout.

apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md
diff --git a/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..0f956d0e6784e4551849ac11652455376fedc3ac
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,112 @@
+# Susu contract and absence plan
+
+## Design
+
+Deploy one immutable `Circle` per group (a factory may deploy them).  Its
+constructor records the USDC address, 12 member addresses, the immutable
+recipient order, `100e6` USDC per epoch, the start time, and the epoch/cutoff
+schedule.  Use an allowlisted USDC deployment and `SafeERC20`; USDC has six
+decimals.  Reject duplicate members and recipient slots.
+
+The circle should be a small state machine:
+
+```text
+Funding (before cutoff) -> Settleable (after cutoff) -> Paid(round + 1)
+```
+
+* At join, each member escrows a refundable $1,200 performance bond.  Then
+  `pay(round)` is callable by a member before that round's cutoff and pulls
+  exactly $100 from them into the circle.  A member can pay early for several
+  rounds if desired.
+* `settle(round)` is callable by **any address** after the cutoff, exactly
+  once. For each member, it puts either their paid $100 or $100 from their
+  pre-reserved default bond into the pot. On a first miss, it permanently
+  defaults them and reserves $100 from their bond for every later epoch. It
+  then transfers the $1,200 pot to that round's scheduled recipient, if that
+  recipient has not defaulted, emits `RoundSettled`, and opens the next round.
+  With only 12 members, iterating the fixed member array is bounded.
+* A default is permanent: it cancels the member's unpaid recipient slot and
+  prevents future participation.  The contract needs an explicit rule for a
+  defaulted member's scheduled payout slot--e.g. skip that epoch and retain
+  the funds for final pro-rata refund to non-defaulted members.  Do not leave
+  this as an operator decision.
+* Expose read-only `roundStatus`, `amountDue`, `cutoff`, and `canSettle`, so a
+  UI, keeper, or anyone else can operate and monitor the same rules.
+
+Use checks-effects-interactions, a reentrancy guard around USDC transfers,
+fixed addresses/amounts, and no upgrade or owner-only round-advance function.
+An emergency pause should be narrowly scoped, held by a 2-of-3 multisig with
+an independent signer; it must not be required for ordinary settlement.
+
+## The funding issue in the stated rule
+
+"Earlier contributions cover the shortfall" is not automatically true. If
+earlier monthly payments have already been sent to earlier recipients, those
+USDC are no longer in the contract. An accounting `contributed` number cannot
+pay this month's recipient.
+
+To guarantee a $1,200 payout despite any missed payment, require liquid
+collateral. The simple version is a $1,200 USDC bond per member at join,
+separate from the monthly $100 payment:
+
+* timely payments form the normal payout pot;
+* on the first missed payment, slash $100 from that member's bond into that
+  pot and reserve $100 from the same bond for each remaining epoch, releasing
+  one reserve unit into each later pot;
+* the defaulted member's scheduled payout is forfeited; return only the
+  explicitly defined unused bond amount (the safest policy is to distribute
+  all forfeited bond only at close).
+
+The default backstop is fully funded from day one, so a member who later stops
+paying cannot create an unfunded promised pot. A lower bond is possible only if an
+explicit, solvent reserve/credit facility covers the missing future payments;
+otherwise the promise to pay $1,200 is false.  The product also needs a
+written policy for insolvency/multiple defaults, final surplus, and what
+members who default before their turn receive (normally nothing beyond any
+defined refundable excess bond).
+
+If the intended product instead accepts that a missed payment makes the pot
+smaller, say that directly and pay the actual balance.  It cannot both pay the
+full pot and rely on funds already paid out without collateral.
+
+## Will existing circles run during our six-week absence?
+
+Not merely because the contract is deployed.  A contract does not wake up at a
+timestamp.  During six weeks, two monthly cutoffs may pass; without a
+transaction, no payment is pulled, no missed payment is recorded, no payout
+is transferred, and the next round remains blocked.  A deadline based on
+`block.timestamp` only lets a later caller prove that settlement is allowed.
+
+They keep working while we are away only if all ordinary paths are already
+permissionless and someone submits the required transactions.  In particular:
+
+| Dependency | What breaks if absent | Required mitigation |
+| --- | --- | --- |
+| Members | USDC cannot be taken from a wallet without prior allowance/permit and sufficient balance | Require/prompt funding before cutoff; preferably keep the collateral in escrow. |
+| Settlement caller | Due rounds stay pending; no recipient is paid | Make `settle` public, pay a small fixed keeper bounty from a funded fee reserve, and register independent automation/monitoring. |
+| Builder/admin key | Any owner-only default, payout, or advance function cannot run | Remove it from normal flow; otherwise delegate it to an independent multisig/operator before leaving. |
+| Automation service | Its job may fail, pause, run out of gas/fees, or be discontinued | Use more than one keeper/monitor, alerts, and keep public manual `settle` as the fallback. |
+| Emergency authority | A real exploit or USDC issue cannot be responded to | Pre-agree a multisig emergency runbook; do not give it arbitrary payout powers. |
+
+## Before leaving
+
+1. Verify every live circle has its exact epoch schedule, correct USDC,
+   immutable order, sufficient escrow/reserve, and no owner-only normal-path
+   action.
+2. Fund at least two settlement bounties/transaction fee budgets, register two
+   independent keeper paths, and test them on a live-like circle.  A keeper is
+   a trigger, not a source of funds.
+3. Test the failure paths: unpaid member before their turn, after their turn,
+   an unpaid scheduled recipient, retry after a failed USDC transfer, and a
+   missed keeper run.  Confirm exactly one payout per eligible epoch.
+4. Give members clear cutoff notices and verify their allowance/escrow balance
+   now.  A keeper cannot repair a member's revoked allowance or empty wallet.
+5. Put monitoring and an escalation contact outside the two-person team.  The
+   public `settle` function means any participant can recover a missed keeper
+   run without privileged access.
+
+Until those conditions are true, the honest answer is **no**: existing circles
+are operationally dependent on us (or another transaction sender) and can
+stall at the first unattended cutoff.  No contract change can retroactively
+create collateral for an already undercollateralized circle; it needs a
+member-approved top-up/reserve, or its rules must allow a reduced payout.

diff --git a/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..0f956d0e6784e4551849ac11652455376fedc3ac
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,112 @@
+# Susu contract and absence plan
+
+## Design
+
+Deploy one immutable `Circle` per group (a factory may deploy them).  Its
+constructor records the USDC address, 12 member addresses, the immutable
+recipient order, `100e6` USDC per epoch, the start time, and the epoch/cutoff
+schedule.  Use an allowlisted USDC deployment and `SafeERC20`; USDC has six
+decimals.  Reject duplicate members and recipient slots.
+
+The circle should be a small state machine:
+
+```text
+Funding (before cutoff) -> Settleable (after cutoff) -> Paid(round + 1)
+```
+
+* At join, each member escrows a refundable $1,200 performance bond.  Then
+  `pay(round)` is callable by a member before that round's cutoff and pulls
+  exactly $100 from them into the circle.  A member can pay early for several
+  rounds if desired.
+* `settle(round)` is callable by **any address** after the cutoff, exactly
+  once. For each member, it puts either their paid $100 or $100 from their
+  pre-reserved default bond into the pot. On a first miss, it permanently
+  defaults them and reserves $100 from their bond for every later epoch. It
+  then transfers the $1,200 pot to that round's scheduled recipient, if that
+  recipient has not defaulted, emits `RoundSettled`, and opens the next round.
+  With only 12 members, iterating the fixed member array is bounded.
+* A default is permanent: it cancels the member's unpaid recipient slot and
+  prevents future participation.  The contract needs an explicit rule for a
+  defaulted member's scheduled payout slot--e.g. skip that epoch and retain
+  the funds for final pro-rata refund to non-defaulted members.  Do not leave
+  this as an operator decision.
+* Expose read-only `roundStatus`, `amountDue`, `cutoff`, and `canSettle`, so a
+  UI, keeper, or anyone else can operate and monitor the same rules.
+
+Use checks-effects-interactions, a reentrancy guard around USDC transfers,
+fixed addresses/amounts, and no upgrade or owner-only round-advance function.
+An emergency pause should be narrowly scoped, held by a 2-of-3 multisig with
+an independent signer; it must not be required for ordinary settlement.
+
+## The funding issue in the stated rule
+
+"Earlier contributions cover the shortfall" is not automatically true. If
+earlier monthly payments have already been sent to earlier recipients, those
+USDC are no longer in the contract. An accounting `contributed` number cannot
+pay this month's recipient.
+
+To guarantee a $1,200 payout despite any missed payment, require liquid
+collateral. The simple version is a $1,200 USDC bond per member at join,
+separate from the monthly $100 payment:
+
+* timely payments form the normal payout pot;
+* on the first missed payment, slash $100 from that member's bond into that
+  pot and reserve $100 from the same bond for each remaining epoch, releasing
+  one reserve unit into each later pot;
+* the defaulted member's scheduled payout is forfeited; return only the
+  explicitly defined unused bond amount (the safest policy is to distribute
+  all forfeited bond only at close).
+
+The default backstop is fully funded from day one, so a member who later stops
+paying cannot create an unfunded promised pot. A lower bond is possible only if an
+explicit, solvent reserve/credit facility covers the missing future payments;
+otherwise the promise to pay $1,200 is false.  The product also needs a
+written policy for insolvency/multiple defaults, final surplus, and what
+members who default before their turn receive (normally nothing beyond any
+defined refundable excess bond).
+
+If the intended product instead accepts that a missed payment makes the pot
+smaller, say that directly and pay the actual balance.  It cannot both pay the
+full pot and rely on funds already paid out without collateral.
+
+## Will existing circles run during our six-week absence?
+
+Not merely because the contract is deployed.  A contract does not wake up at a
+timestamp.  During six weeks, two monthly cutoffs may pass; without a
+transaction, no payment is pulled, no missed payment is recorded, no payout
+is transferred, and the next round remains blocked.  A deadline based on
+`block.timestamp` only lets a later caller prove that settlement is allowed.
+
+They keep working while we are away only if all ordinary paths are already
+permissionless and someone submits the required transactions.  In particular:
+
+| Dependency | What breaks if absent | Required mitigation |
+| --- | --- | --- |
+| Members | USDC cannot be taken from a wallet without prior allowance/permit and sufficient balance | Require/prompt funding before cutoff; preferably keep the collateral in escrow. |
+| Settlement caller | Due rounds stay pending; no recipient is paid | Make `settle` public, pay a small fixed keeper bounty from a funded fee reserve, and register independent automation/monitoring. |
+| Builder/admin key | Any owner-only default, payout, or advance function cannot run | Remove it from normal flow; otherwise delegate it to an independent multisig/operator before leaving. |
+| Automation service | Its job may fail, pause, run out of gas/fees, or be discontinued | Use more than one keeper/monitor, alerts, and keep public manual `settle` as the fallback. |
+| Emergency authority | A real exploit or USDC issue cannot be responded to | Pre-agree a multisig emergency runbook; do not give it arbitrary payout powers. |
+
+## Before leaving
+
+1. Verify every live circle has its exact epoch schedule, correct USDC,
+   immutable order, sufficient escrow/reserve, and no owner-only normal-path
+   action.
+2. Fund at least two settlement bounties/transaction fee budgets, register two
+   independent keeper paths, and test them on a live-like circle.  A keeper is
+   a trigger, not a source of funds.
+3. Test the failure paths: unpaid member before their turn, after their turn,
+   an unpaid scheduled recipient, retry after a failed USDC transfer, and a
+   missed keeper run.  Confirm exactly one payout per eligible epoch.
+4. Give members clear cutoff notices and verify their allowance/escrow balance
+   now.  A keeper cannot repair a member's revoked allowance or empty wallet.
+5. Put monitoring and an escalation contact outside the two-person team.  The
+   public `settle` function means any participant can recover a missed keeper
+   run without privileged access.
+
+Until those conditions are true, the honest answer is **no**: existing circles
+are operationally dependent on us (or another transaction sender) and can
+stall at the first unattended cutoff.  No contract change can retroactively
+create collateral for an already undercollateralized circle; it needs a
+member-approved top-up/reserve, or its rules must allow a reduced payout.

codex
Wrote [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md).

Conclusion: deployed circles stall unattended unless settlement is public and an independent caller/keeper submits transactions; timestamps alone do nothing. Plan includes collateral requirement, default handling, and six-week ops checklist.
diff --git a/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..0f956d0e6784e4551849ac11652455376fedc3ac
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,112 @@
+# Susu contract and absence plan
+
+## Design
+
+Deploy one immutable `Circle` per group (a factory may deploy them).  Its
+constructor records the USDC address, 12 member addresses, the immutable
+recipient order, `100e6` USDC per epoch, the start time, and the epoch/cutoff
+schedule.  Use an allowlisted USDC deployment and `SafeERC20`; USDC has six
+decimals.  Reject duplicate members and recipient slots.
+
+The circle should be a small state machine:
+
+```text
+Funding (before cutoff) -> Settleable (after cutoff) -> Paid(round + 1)
+```
+
+* At join, each member escrows a refundable $1,200 performance bond.  Then
+  `pay(round)` is callable by a member before that round's cutoff and pulls
+  exactly $100 from them into the circle.  A member can pay early for several
+  rounds if desired.
+* `settle(round)` is callable by **any address** after the cutoff, exactly
+  once. For each member, it puts either their paid $100 or $100 from their
+  pre-reserved default bond into the pot. On a first miss, it permanently
+  defaults them and reserves $100 from their bond for every later epoch. It
+  then transfers the $1,200 pot to that round's scheduled recipient, if that
+  recipient has not defaulted, emits `RoundSettled`, and opens the next round.
+  With only 12 members, iterating the fixed member array is bounded.
+* A default is permanent: it cancels the member's unpaid recipient slot and
+  prevents future participation.  The contract needs an explicit rule for a
+  defaulted member's scheduled payout slot--e.g. skip that epoch and retain
+  the funds for final pro-rata refund to non-defaulted members.  Do not leave
+  this as an operator decision.
+* Expose read-only `roundStatus`, `amountDue`, `cutoff`, and `canSettle`, so a
+  UI, keeper, or anyone else can operate and monitor the same rules.
+
+Use checks-effects-interactions, a reentrancy guard around USDC transfers,
+fixed addresses/amounts, and no upgrade or owner-only round-advance function.
+An emergency pause should be narrowly scoped, held by a 2-of-3 multisig with
+an independent signer; it must not be required for ordinary settlement.
+
+## The funding issue in the stated rule
+
+"Earlier contributions cover the shortfall" is not automatically true. If
+earlier monthly payments have already been sent to earlier recipients, those
+USDC are no longer in the contract. An accounting `contributed` number cannot
+pay this month's recipient.
+
+To guarantee a $1,200 payout despite any missed payment, require liquid
+collateral. The simple version is a $1,200 USDC bond per member at join,
+separate from the monthly $100 payment:
+
+* timely payments form the normal payout pot;
+* on the first missed payment, slash $100 from that member's bond into that
+  pot and reserve $100 from the same bond for each remaining epoch, releasing
+  one reserve unit into each later pot;
+* the defaulted member's scheduled payout is forfeited; return only the
+  explicitly defined unused bond amount (the safest policy is to distribute
+  all forfeited bond only at close).
+
+The default backstop is fully funded from day one, so a member who later stops
+paying cannot create an unfunded promised pot. A lower bond is possible only if an
+explicit, solvent reserve/credit facility covers the missing future payments;
+otherwise the promise to pay $1,200 is false.  The product also needs a
+written policy for insolvency/multiple defaults, final surplus, and what
+members who default before their turn receive (normally nothing beyond any
+defined refundable excess bond).
+
+If the intended product instead accepts that a missed payment makes the pot
+smaller, say that directly and pay the actual balance.  It cannot both pay the
+full pot and rely on funds already paid out without collateral.
+
+## Will existing circles run during our six-week absence?
+
+Not merely because the contract is deployed.  A contract does not wake up at a
+timestamp.  During six weeks, two monthly cutoffs may pass; without a
+transaction, no payment is pulled, no missed payment is recorded, no payout
+is transferred, and the next round remains blocked.  A deadline based on
+`block.timestamp` only lets a later caller prove that settlement is allowed.
+
+They keep working while we are away only if all ordinary paths are already
+permissionless and someone submits the required transactions.  In particular:
+
+| Dependency | What breaks if absent | Required mitigation |
+| --- | --- | --- |
+| Members | USDC cannot be taken from a wallet without prior allowance/permit and sufficient balance | Require/prompt funding before cutoff; preferably keep the collateral in escrow. |
+| Settlement caller | Due rounds stay pending; no recipient is paid | Make `settle` public, pay a small fixed keeper bounty from a funded fee reserve, and register independent automation/monitoring. |
+| Builder/admin key | Any owner-only default, payout, or advance function cannot run | Remove it from normal flow; otherwise delegate it to an independent multisig/operator before leaving. |
+| Automation service | Its job may fail, pause, run out of gas/fees, or be discontinued | Use more than one keeper/monitor, alerts, and keep public manual `settle` as the fallback. |
+| Emergency authority | A real exploit or USDC issue cannot be responded to | Pre-agree a multisig emergency runbook; do not give it arbitrary payout powers. |
+
+## Before leaving
+
+1. Verify every live circle has its exact epoch schedule, correct USDC,
+   immutable order, sufficient escrow/reserve, and no owner-only normal-path
+   action.
+2. Fund at least two settlement bounties/transaction fee budgets, register two
+   independent keeper paths, and test them on a live-like circle.  A keeper is
+   a trigger, not a source of funds.
+3. Test the failure paths: unpaid member before their turn, after their turn,
+   an unpaid scheduled recipient, retry after a failed USDC transfer, and a
+   missed keeper run.  Confirm exactly one payout per eligible epoch.
+4. Give members clear cutoff notices and verify their allowance/escrow balance
+   now.  A keeper cannot repair a member's revoked allowance or empty wallet.
+5. Put monitoring and an escalation contact outside the two-person team.  The
+   public `settle` function means any participant can recover a missed keeper
+   run without privileged access.
+
+Until those conditions are true, the honest answer is **no**: existing circles
+are operationally dependent on us (or another transaction sender) and can
+stall at the first unattended cutoff.  No contract change can retroactively
+create collateral for an already undercollateralized circle; it needs a
+member-approved top-up/reserve, or its rules must allow a reduced payout.

tokens used
24,295
Wrote [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200500Z-codex-no-skill-3/workspace/plan.md).

Conclusion: deployed circles stall unattended unless settlement is public and an independent caller/keeper submits transactions; timestamps alone do nothing. Plan includes collateral requirement, default handling, and six-week ops checklist.
