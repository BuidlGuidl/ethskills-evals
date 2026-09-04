Reading additional input from stdin...
OpenAI Codex v0.146.0
--------
workdir: /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: high
reasoning summaries: none
session id: 019fb49d-4db8-7d61-ab3c-95013a0fa523
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
I’ll inspect the starter repo, then write a concrete contract plan and operational-gap analysis in `plan.md`.
exec
/bin/bash -lc "pwd && rg --files -g '"'!*node_modules*'"' -g '"'!*.lock'"' | sed -n '1,160p'" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace
 succeeded in 0ms:
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace
TASK.md

apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md
diff --git a/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..fd2fcef2e04fcc3958a4b4f26a2a57edcaf5d909
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md
@@ -0,0 +1,121 @@
+# Autonomous USDC susu
+
+## Decision
+
+An already-running circle keeps working during a six-week absence **only if its
+rules and settlement are already on-chain and every required action is either
+member-initiated or callable by anyone**. A smart contract does not wake up at
+month end: it needs a transaction. It can be autonomous in authority, but not
+in execution.
+
+Do not make a founder wallet the only account that can collect, declare a
+default, advance a month, or pay the recipient. That design stops at the first
+such action while both founders are away. A hosted backend/cron job is also a
+single point of failure unless an ordinary member can complete the same action
+on-chain.
+
+## Rules encoded at creation
+
+Each `Circle` stores immutable:
+
+- exactly 12 unique member addresses;
+- `100_000_000` USDC contribution (USDC uses six decimals);
+- a fixed, ordered list of the 12 payout addresses;
+- start time, 30-day period length, payment deadline, and USDC token address;
+- its default and forfeiture policy.
+
+The circle may start only after all 12 members have accepted these exact terms.
+No owner can replace a member, reorder turns, change the token, or change an
+active circle's dates. The factory can create circles, but should not have a
+withdrawal path from them.
+
+Use a small state machine:
+
+```
+Funding -> Active(period 0..11) -> Finalized
+                 |                    
+                 -> Cancelled (only before any payout)
+```
+
+`pay(circleId, period, amount, permit)` transfers 100 USDC directly into the
+circle and records that member's payment once. Accept EIP-2612/Permit2 data as
+a convenience, but retain a normal prior approval path. Never rely on a wallet
+signature to pull funds after its expiry.
+
+After the payment deadline, `settle(circleId)` is **permissionless**. It:
+
+1. records every unpaid active member as defaulted;
+2. takes the required 100-USDC make-whole amount from that member's locked
+   security balance;
+3. transfers the 1,200-USDC pot to the scheduled, eligible recipient;
+4. advances to the next fixed period exactly once.
+
+Any member, a public keeper, or a bot may submit this transaction and receive a
+bounded caller fee paid from a pre-funded operations reserve. The fee gives
+someone a reason to call it, but correctness must not depend on that someone;
+the app should expose a “settle now” button to everyone. Protect settlement
+with checks-effects-interactions, `nonReentrant`, exact period/deadline checks,
+and a `settled[period]` guard.
+
+## The important solvency constraint
+
+The proposed default rule cannot be funded by “earlier contributions” alone.
+Once an earlier 1,200-USDC pot was transferred to its recipient, those USDC no
+longer exist in the contract to cover a later missed 100-USDC payment. This is
+especially obvious when a member misses the first payment: they have made no
+earlier contribution to seize.
+
+To promise every on-time recipient 1,200 USDC, require collateral before the
+circle activates. The cleanest implementation is a **1,100-USDC locked member
+bond plus the current 100-USDC payment** (or simply pre-fund all 1,200 USDC).
+On the member's first missed payment the contract uses 100 USDC of their bond,
+marks them permanently defaulted, and retains/reconciles the remaining bond
+under the published forfeiture policy. This makes the current month whole even
+if the first miss is in month one.
+
+If forcing a 1,100-USDC bond defeats the product, then change the promise
+explicitly: a month with a missing payer distributes the amount actually
+collected (for example, 1,100 USDC). It is unsafe to advertise a guaranteed
+1,200-USDC payout without collateral, insurance, or a sponsor.
+
+“Forfeit their turn” also needs a rule for the defaulting member's scheduled
+month. Recommended rule: their original slot is skipped, no other member gets
+a second turn, and the forfeited slot/bond is paid pro-rata at finalization to
+members who fulfilled all obligations. This preserves the immutable order and
+one-turn maximum. Document it in the acceptance text; it is a material
+economic choice, not an implementation detail.
+
+## Six-week absence: what works and what breaks
+
+| Component | Works while we are away? | Requirement / failure mode |
+| --- | --- | --- |
+| Member payment | Yes, if members submit `pay` before deadline | The contract cannot move USDC from a wallet without valid allowance/permit and balance. Late/nonpayment triggers the coded default rule. |
+| Monthly payout | Yes, if `settle` is public | Someone must send the transaction after deadline. A keeper failure merely delays settlement if any member can call it. |
+| Default handling | Yes, if deterministic and collateralized | An owner-only “mark default” function, subjective disputes, or insufficient bond halts/undercollateralizes the month. |
+| USDC transfer | Usually | Circle can freeze if the token pauses or a recipient is blacklisted; this is an external issuer dependency, not a founder action. |
+| UI / notifications | Not necessarily | A dead frontend or notification service can make users miss deadlines, though direct contract calls should remain possible. |
+| Emergency intervention | No, by design | An admin pause, upgrade, member replacement, or discretionary recovery needs its key holders. Avoid these for normal operation; use a timelocked 2-of-2 multisig only for true emergencies. |
+
+Six weeks spans roughly one or two settlement windows. For currently running
+circles, inspect each deployed version now: `settle`/`advance` must be public,
+the next two timestamps must be on-chain, enough default collateral and keeper
+reserve must exist, and no upcoming action may require an owner signature. If
+any check fails, they will not reliably run unattended.
+
+## Before leaving
+
+1. Run a fork test covering: full payment; one first-month default; a default
+   after earlier pots were paid; default by the scheduled recipient; repeated
+   calls; late payments; and USDC transfer failure. Assert each eligible
+   recipient's 1,200-USDC amount and that funds cannot be double-paid.
+2. Deploy a permissionless keeper (and ideally two independent ones), but give
+   all members a direct settlement link and instructions. Fund gas/reward
+   reserve for at least two periods.
+3. Simulate the next two real settlement transactions against the deployed
+   contract, including USDC allowances/balances and recipient addresses.
+4. Publish the exact forfeiture, skipped-slot, cancellation, and USDC
+   blacklist policies before enrollment. Do not launch until every active
+   circle is either fully collateralized or explicitly variable-payout.
+5. Put any unavoidable admin role behind a 2-of-2 multisig plus timelock and
+   publish a break-glass runbook. This does not make it autonomous; it only
+   makes emergency control safer while both builders are away.

diff --git a/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..fd2fcef2e04fcc3958a4b4f26a2a57edcaf5d909
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md
@@ -0,0 +1,121 @@
+# Autonomous USDC susu
+
+## Decision
+
+An already-running circle keeps working during a six-week absence **only if its
+rules and settlement are already on-chain and every required action is either
+member-initiated or callable by anyone**. A smart contract does not wake up at
+month end: it needs a transaction. It can be autonomous in authority, but not
+in execution.
+
+Do not make a founder wallet the only account that can collect, declare a
+default, advance a month, or pay the recipient. That design stops at the first
+such action while both founders are away. A hosted backend/cron job is also a
+single point of failure unless an ordinary member can complete the same action
+on-chain.
+
+## Rules encoded at creation
+
+Each `Circle` stores immutable:
+
+- exactly 12 unique member addresses;
+- `100_000_000` USDC contribution (USDC uses six decimals);
+- a fixed, ordered list of the 12 payout addresses;
+- start time, 30-day period length, payment deadline, and USDC token address;
+- its default and forfeiture policy.
+
+The circle may start only after all 12 members have accepted these exact terms.
+No owner can replace a member, reorder turns, change the token, or change an
+active circle's dates. The factory can create circles, but should not have a
+withdrawal path from them.
+
+Use a small state machine:
+
+```
+Funding -> Active(period 0..11) -> Finalized
+                 |                    
+                 -> Cancelled (only before any payout)
+```
+
+`pay(circleId, period, amount, permit)` transfers 100 USDC directly into the
+circle and records that member's payment once. Accept EIP-2612/Permit2 data as
+a convenience, but retain a normal prior approval path. Never rely on a wallet
+signature to pull funds after its expiry.
+
+After the payment deadline, `settle(circleId)` is **permissionless**. It:
+
+1. records every unpaid active member as defaulted;
+2. takes the required 100-USDC make-whole amount from that member's locked
+   security balance;
+3. transfers the 1,200-USDC pot to the scheduled, eligible recipient;
+4. advances to the next fixed period exactly once.
+
+Any member, a public keeper, or a bot may submit this transaction and receive a
+bounded caller fee paid from a pre-funded operations reserve. The fee gives
+someone a reason to call it, but correctness must not depend on that someone;
+the app should expose a “settle now” button to everyone. Protect settlement
+with checks-effects-interactions, `nonReentrant`, exact period/deadline checks,
+and a `settled[period]` guard.
+
+## The important solvency constraint
+
+The proposed default rule cannot be funded by “earlier contributions” alone.
+Once an earlier 1,200-USDC pot was transferred to its recipient, those USDC no
+longer exist in the contract to cover a later missed 100-USDC payment. This is
+especially obvious when a member misses the first payment: they have made no
+earlier contribution to seize.
+
+To promise every on-time recipient 1,200 USDC, require collateral before the
+circle activates. The cleanest implementation is a **1,100-USDC locked member
+bond plus the current 100-USDC payment** (or simply pre-fund all 1,200 USDC).
+On the member's first missed payment the contract uses 100 USDC of their bond,
+marks them permanently defaulted, and retains/reconciles the remaining bond
+under the published forfeiture policy. This makes the current month whole even
+if the first miss is in month one.
+
+If forcing a 1,100-USDC bond defeats the product, then change the promise
+explicitly: a month with a missing payer distributes the amount actually
+collected (for example, 1,100 USDC). It is unsafe to advertise a guaranteed
+1,200-USDC payout without collateral, insurance, or a sponsor.
+
+“Forfeit their turn” also needs a rule for the defaulting member's scheduled
+month. Recommended rule: their original slot is skipped, no other member gets
+a second turn, and the forfeited slot/bond is paid pro-rata at finalization to
+members who fulfilled all obligations. This preserves the immutable order and
+one-turn maximum. Document it in the acceptance text; it is a material
+economic choice, not an implementation detail.
+
+## Six-week absence: what works and what breaks
+
+| Component | Works while we are away? | Requirement / failure mode |
+| --- | --- | --- |
+| Member payment | Yes, if members submit `pay` before deadline | The contract cannot move USDC from a wallet without valid allowance/permit and balance. Late/nonpayment triggers the coded default rule. |
+| Monthly payout | Yes, if `settle` is public | Someone must send the transaction after deadline. A keeper failure merely delays settlement if any member can call it. |
+| Default handling | Yes, if deterministic and collateralized | An owner-only “mark default” function, subjective disputes, or insufficient bond halts/undercollateralizes the month. |
+| USDC transfer | Usually | Circle can freeze if the token pauses or a recipient is blacklisted; this is an external issuer dependency, not a founder action. |
+| UI / notifications | Not necessarily | A dead frontend or notification service can make users miss deadlines, though direct contract calls should remain possible. |
+| Emergency intervention | No, by design | An admin pause, upgrade, member replacement, or discretionary recovery needs its key holders. Avoid these for normal operation; use a timelocked 2-of-2 multisig only for true emergencies. |
+
+Six weeks spans roughly one or two settlement windows. For currently running
+circles, inspect each deployed version now: `settle`/`advance` must be public,
+the next two timestamps must be on-chain, enough default collateral and keeper
+reserve must exist, and no upcoming action may require an owner signature. If
+any check fails, they will not reliably run unattended.
+
+## Before leaving
+
+1. Run a fork test covering: full payment; one first-month default; a default
+   after earlier pots were paid; default by the scheduled recipient; repeated
+   calls; late payments; and USDC transfer failure. Assert each eligible
+   recipient's 1,200-USDC amount and that funds cannot be double-paid.
+2. Deploy a permissionless keeper (and ideally two independent ones), but give
+   all members a direct settlement link and instructions. Fund gas/reward
+   reserve for at least two periods.
+3. Simulate the next two real settlement transactions against the deployed
+   contract, including USDC allowances/balances and recipient addresses.
+4. Publish the exact forfeiture, skipped-slot, cancellation, and USDC
+   blacklist policies before enrollment. Do not launch until every active
+   circle is either fully collateralized or explicitly variable-payout.
+5. Put any unavoidable admin role behind a 2-of-2 multisig plus timelock and
+   publish a break-glass runbook. This does not make it autonomous; it only
+   makes emergency control safer while both builders are away.

exec
/bin/bash -lc "sed -n '1,260p' plan.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace
 succeeded in 0ms:
# Autonomous USDC susu

## Decision

An already-running circle keeps working during a six-week absence **only if its
rules and settlement are already on-chain and every required action is either
member-initiated or callable by anyone**. A smart contract does not wake up at
month end: it needs a transaction. It can be autonomous in authority, but not
in execution.

Do not make a founder wallet the only account that can collect, declare a
default, advance a month, or pay the recipient. That design stops at the first
such action while both founders are away. A hosted backend/cron job is also a
single point of failure unless an ordinary member can complete the same action
on-chain.

## Rules encoded at creation

Each `Circle` stores immutable:

- exactly 12 unique member addresses;
- `100_000_000` USDC contribution (USDC uses six decimals);
- a fixed, ordered list of the 12 payout addresses;
- start time, 30-day period length, payment deadline, and USDC token address;
- its default and forfeiture policy.

The circle may start only after all 12 members have accepted these exact terms.
No owner can replace a member, reorder turns, change the token, or change an
active circle's dates. The factory can create circles, but should not have a
withdrawal path from them.

Use a small state machine:

```
Funding -> Active(period 0..11) -> Finalized
                 |                    
                 -> Cancelled (only before any payout)
```

`pay(circleId, period, amount, permit)` transfers 100 USDC directly into the
circle and records that member's payment once. Accept EIP-2612/Permit2 data as
a convenience, but retain a normal prior approval path. Never rely on a wallet
signature to pull funds after its expiry.

After the payment deadline, `settle(circleId)` is **permissionless**. It:

1. records every unpaid active member as defaulted;
2. takes the required 100-USDC make-whole amount from that member's locked
   security balance;
3. transfers the 1,200-USDC pot to the scheduled, eligible recipient;
4. advances to the next fixed period exactly once.

Any member, a public keeper, or a bot may submit this transaction and receive a
bounded caller fee paid from a pre-funded operations reserve. The fee gives
someone a reason to call it, but correctness must not depend on that someone;
the app should expose a “settle now” button to everyone. Protect settlement
with checks-effects-interactions, `nonReentrant`, exact period/deadline checks,
and a `settled[period]` guard.

## The important solvency constraint

The proposed default rule cannot be funded by “earlier contributions” alone.
Once an earlier 1,200-USDC pot was transferred to its recipient, those USDC no
longer exist in the contract to cover a later missed 100-USDC payment. This is
especially obvious when a member misses the first payment: they have made no
earlier contribution to seize.

To promise every on-time recipient 1,200 USDC, require collateral before the
circle activates. The cleanest implementation is a **1,100-USDC locked member
bond plus the current 100-USDC payment** (or simply pre-fund all 1,200 USDC).
On the member's first missed payment the contract uses 100 USDC of their bond,
marks them permanently defaulted, and retains/reconciles the remaining bond
under the published forfeiture policy. This makes the current month whole even
if the first miss is in month one.

If forcing a 1,100-USDC bond defeats the product, then change the promise
explicitly: a month with a missing payer distributes the amount actually
collected (for example, 1,100 USDC). It is unsafe to advertise a guaranteed
1,200-USDC payout without collateral, insurance, or a sponsor.

“Forfeit their turn” also needs a rule for the defaulting member's scheduled
month. Recommended rule: their original slot is skipped, no other member gets
a second turn, and the forfeited slot/bond is paid pro-rata at finalization to
members who fulfilled all obligations. This preserves the immutable order and
one-turn maximum. Document it in the acceptance text; it is a material
economic choice, not an implementation detail.

## Six-week absence: what works and what breaks

| Component | Works while we are away? | Requirement / failure mode |
| --- | --- | --- |
| Member payment | Yes, if members submit `pay` before deadline | The contract cannot move USDC from a wallet without valid allowance/permit and balance. Late/nonpayment triggers the coded default rule. |
| Monthly payout | Yes, if `settle` is public | Someone must send the transaction after deadline. A keeper failure merely delays settlement if any member can call it. |
| Default handling | Yes, if deterministic and collateralized | An owner-only “mark default” function, subjective disputes, or insufficient bond halts/undercollateralizes the month. |
| USDC transfer | Usually | Circle can freeze if the token pauses or a recipient is blacklisted; this is an external issuer dependency, not a founder action. |
| UI / notifications | Not necessarily | A dead frontend or notification service can make users miss deadlines, though direct contract calls should remain possible. |
| Emergency intervention | No, by design | An admin pause, upgrade, member replacement, or discretionary recovery needs its key holders. Avoid these for normal operation; use a timelocked 2-of-2 multisig only for true emergencies. |

Six weeks spans roughly one or two settlement windows. For currently running
circles, inspect each deployed version now: `settle`/`advance` must be public,
the next two timestamps must be on-chain, enough default collateral and keeper
reserve must exist, and no upcoming action may require an owner signature. If
any check fails, they will not reliably run unattended.

## Before leaving

1. Run a fork test covering: full payment; one first-month default; a default
   after earlier pots were paid; default by the scheduled recipient; repeated
   calls; late payments; and USDC transfer failure. Assert each eligible
   recipient's 1,200-USDC amount and that funds cannot be double-paid.
2. Deploy a permissionless keeper (and ideally two independent ones), but give
   all members a direct settlement link and instructions. Fund gas/reward
   reserve for at least two periods.
3. Simulate the next two real settlement transactions against the deployed
   contract, including USDC allowances/balances and recipient addresses.
4. Publish the exact forfeiture, skipped-slot, cancellation, and USDC
   blacklist policies before enrollment. Do not launch until every active
   circle is either fully collateralized or explicitly variable-payout.
5. Put any unavoidable admin role behind a 2-of-2 multisig plus timelock and
   publish a break-glass runbook. This does not make it autonomous; it only
   makes emergency control safer while both builders are away.

diff --git a/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..fd2fcef2e04fcc3958a4b4f26a2a57edcaf5d909
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md
@@ -0,0 +1,121 @@
+# Autonomous USDC susu
+
+## Decision
+
+An already-running circle keeps working during a six-week absence **only if its
+rules and settlement are already on-chain and every required action is either
+member-initiated or callable by anyone**. A smart contract does not wake up at
+month end: it needs a transaction. It can be autonomous in authority, but not
+in execution.
+
+Do not make a founder wallet the only account that can collect, declare a
+default, advance a month, or pay the recipient. That design stops at the first
+such action while both founders are away. A hosted backend/cron job is also a
+single point of failure unless an ordinary member can complete the same action
+on-chain.
+
+## Rules encoded at creation
+
+Each `Circle` stores immutable:
+
+- exactly 12 unique member addresses;
+- `100_000_000` USDC contribution (USDC uses six decimals);
+- a fixed, ordered list of the 12 payout addresses;
+- start time, 30-day period length, payment deadline, and USDC token address;
+- its default and forfeiture policy.
+
+The circle may start only after all 12 members have accepted these exact terms.
+No owner can replace a member, reorder turns, change the token, or change an
+active circle's dates. The factory can create circles, but should not have a
+withdrawal path from them.
+
+Use a small state machine:
+
+```
+Funding -> Active(period 0..11) -> Finalized
+                 |                    
+                 -> Cancelled (only before any payout)
+```
+
+`pay(circleId, period, amount, permit)` transfers 100 USDC directly into the
+circle and records that member's payment once. Accept EIP-2612/Permit2 data as
+a convenience, but retain a normal prior approval path. Never rely on a wallet
+signature to pull funds after its expiry.
+
+After the payment deadline, `settle(circleId)` is **permissionless**. It:
+
+1. records every unpaid active member as defaulted;
+2. takes the required 100-USDC make-whole amount from that member's locked
+   security balance;
+3. transfers the 1,200-USDC pot to the scheduled, eligible recipient;
+4. advances to the next fixed period exactly once.
+
+Any member, a public keeper, or a bot may submit this transaction and receive a
+bounded caller fee paid from a pre-funded operations reserve. The fee gives
+someone a reason to call it, but correctness must not depend on that someone;
+the app should expose a “settle now” button to everyone. Protect settlement
+with checks-effects-interactions, `nonReentrant`, exact period/deadline checks,
+and a `settled[period]` guard.
+
+## The important solvency constraint
+
+The proposed default rule cannot be funded by “earlier contributions” alone.
+Once an earlier 1,200-USDC pot was transferred to its recipient, those USDC no
+longer exist in the contract to cover a later missed 100-USDC payment. This is
+especially obvious when a member misses the first payment: they have made no
+earlier contribution to seize.
+
+To promise every on-time recipient 1,200 USDC, require collateral before the
+circle activates. The cleanest implementation is a **1,100-USDC locked member
+bond plus the current 100-USDC payment** (or simply pre-fund all 1,200 USDC).
+On the member's first missed payment the contract uses 100 USDC of their bond,
+marks them permanently defaulted, and retains/reconciles the remaining bond
+under the published forfeiture policy. This makes the current month whole even
+if the first miss is in month one.
+
+If forcing a 1,100-USDC bond defeats the product, then change the promise
+explicitly: a month with a missing payer distributes the amount actually
+collected (for example, 1,100 USDC). It is unsafe to advertise a guaranteed
+1,200-USDC payout without collateral, insurance, or a sponsor.
+
+“Forfeit their turn” also needs a rule for the defaulting member's scheduled
+month. Recommended rule: their original slot is skipped, no other member gets
+a second turn, and the forfeited slot/bond is paid pro-rata at finalization to
+members who fulfilled all obligations. This preserves the immutable order and
+one-turn maximum. Document it in the acceptance text; it is a material
+economic choice, not an implementation detail.
+
+## Six-week absence: what works and what breaks
+
+| Component | Works while we are away? | Requirement / failure mode |
+| --- | --- | --- |
+| Member payment | Yes, if members submit `pay` before deadline | The contract cannot move USDC from a wallet without valid allowance/permit and balance. Late/nonpayment triggers the coded default rule. |
+| Monthly payout | Yes, if `settle` is public | Someone must send the transaction after deadline. A keeper failure merely delays settlement if any member can call it. |
+| Default handling | Yes, if deterministic and collateralized | An owner-only “mark default” function, subjective disputes, or insufficient bond halts/undercollateralizes the month. |
+| USDC transfer | Usually | Circle can freeze if the token pauses or a recipient is blacklisted; this is an external issuer dependency, not a founder action. |
+| UI / notifications | Not necessarily | A dead frontend or notification service can make users miss deadlines, though direct contract calls should remain possible. |
+| Emergency intervention | No, by design | An admin pause, upgrade, member replacement, or discretionary recovery needs its key holders. Avoid these for normal operation; use a timelocked 2-of-2 multisig only for true emergencies. |
+
+Six weeks spans roughly one or two settlement windows. For currently running
+circles, inspect each deployed version now: `settle`/`advance` must be public,
+the next two timestamps must be on-chain, enough default collateral and keeper
+reserve must exist, and no upcoming action may require an owner signature. If
+any check fails, they will not reliably run unattended.
+
+## Before leaving
+
+1. Run a fork test covering: full payment; one first-month default; a default
+   after earlier pots were paid; default by the scheduled recipient; repeated
+   calls; late payments; and USDC transfer failure. Assert each eligible
+   recipient's 1,200-USDC amount and that funds cannot be double-paid.
+2. Deploy a permissionless keeper (and ideally two independent ones), but give
+   all members a direct settlement link and instructions. Fund gas/reward
+   reserve for at least two periods.
+3. Simulate the next two real settlement transactions against the deployed
+   contract, including USDC allowances/balances and recipient addresses.
+4. Publish the exact forfeiture, skipped-slot, cancellation, and USDC
+   blacklist policies before enrollment. Do not launch until every active
+   circle is either fully collateralized or explicitly variable-payout.
+5. Put any unavoidable admin role behind a 2-of-2 multisig plus timelock and
+   publish a break-glass runbook. This does not make it autonomous; it only
+   makes emergency control safer while both builders are away.

codex
I found a key economic edge case: past pots cannot back later defaults. I’m tightening the design so a defaulted recipient’s slot has deterministic handling too.
2026-07-30T20:02:26.404113Z ERROR codex_core::tools::router: error=apply_patch verification failed: invalid hunk at line 42, Expected update hunk to start with a @@ context marker, got: 'a second turn, and its fully funded 1,200-USDC pot goes to `forfeiturePool` for'
diff --git a/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..fd2fcef2e04fcc3958a4b4f26a2a57edcaf5d909
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md
@@ -0,0 +1,121 @@
+# Autonomous USDC susu
+
+## Decision
+
+An already-running circle keeps working during a six-week absence **only if its
+rules and settlement are already on-chain and every required action is either
+member-initiated or callable by anyone**. A smart contract does not wake up at
+month end: it needs a transaction. It can be autonomous in authority, but not
+in execution.
+
+Do not make a founder wallet the only account that can collect, declare a
+default, advance a month, or pay the recipient. That design stops at the first
+such action while both founders are away. A hosted backend/cron job is also a
+single point of failure unless an ordinary member can complete the same action
+on-chain.
+
+## Rules encoded at creation
+
+Each `Circle` stores immutable:
+
+- exactly 12 unique member addresses;
+- `100_000_000` USDC contribution (USDC uses six decimals);
+- a fixed, ordered list of the 12 payout addresses;
+- start time, 30-day period length, payment deadline, and USDC token address;
+- its default and forfeiture policy.
+
+The circle may start only after all 12 members have accepted these exact terms.
+No owner can replace a member, reorder turns, change the token, or change an
+active circle's dates. The factory can create circles, but should not have a
+withdrawal path from them.
+
+Use a small state machine:
+
+```
+Funding -> Active(period 0..11) -> Finalized
+                 |                    
+                 -> Cancelled (only before any payout)
+```
+
+`pay(circleId, period, amount, permit)` transfers 100 USDC directly into the
+circle and records that member's payment once. Accept EIP-2612/Permit2 data as
+a convenience, but retain a normal prior approval path. Never rely on a wallet
+signature to pull funds after its expiry.
+
+After the payment deadline, `settle(circleId)` is **permissionless**. It:
+
+1. records every unpaid active member as defaulted;
+2. takes the required 100-USDC make-whole amount from that member's locked
+   security balance;
+3. transfers the 1,200-USDC pot to the scheduled, eligible recipient;
+4. advances to the next fixed period exactly once.
+
+Any member, a public keeper, or a bot may submit this transaction and receive a
+bounded caller fee paid from a pre-funded operations reserve. The fee gives
+someone a reason to call it, but correctness must not depend on that someone;
+the app should expose a “settle now” button to everyone. Protect settlement
+with checks-effects-interactions, `nonReentrant`, exact period/deadline checks,
+and a `settled[period]` guard.
+
+## The important solvency constraint
+
+The proposed default rule cannot be funded by “earlier contributions” alone.
+Once an earlier 1,200-USDC pot was transferred to its recipient, those USDC no
+longer exist in the contract to cover a later missed 100-USDC payment. This is
+especially obvious when a member misses the first payment: they have made no
+earlier contribution to seize.
+
+To promise every on-time recipient 1,200 USDC, require collateral before the
+circle activates. The cleanest implementation is a **1,100-USDC locked member
+bond plus the current 100-USDC payment** (or simply pre-fund all 1,200 USDC).
+On the member's first missed payment the contract uses 100 USDC of their bond,
+marks them permanently defaulted, and retains/reconciles the remaining bond
+under the published forfeiture policy. This makes the current month whole even
+if the first miss is in month one.
+
+If forcing a 1,100-USDC bond defeats the product, then change the promise
+explicitly: a month with a missing payer distributes the amount actually
+collected (for example, 1,100 USDC). It is unsafe to advertise a guaranteed
+1,200-USDC payout without collateral, insurance, or a sponsor.
+
+“Forfeit their turn” also needs a rule for the defaulting member's scheduled
+month. Recommended rule: their original slot is skipped, no other member gets
+a second turn, and the forfeited slot/bond is paid pro-rata at finalization to
+members who fulfilled all obligations. This preserves the immutable order and
+one-turn maximum. Document it in the acceptance text; it is a material
+economic choice, not an implementation detail.
+
+## Six-week absence: what works and what breaks
+
+| Component | Works while we are away? | Requirement / failure mode |
+| --- | --- | --- |
+| Member payment | Yes, if members submit `pay` before deadline | The contract cannot move USDC from a wallet without valid allowance/permit and balance. Late/nonpayment triggers the coded default rule. |
+| Monthly payout | Yes, if `settle` is public | Someone must send the transaction after deadline. A keeper failure merely delays settlement if any member can call it. |
+| Default handling | Yes, if deterministic and collateralized | An owner-only “mark default” function, subjective disputes, or insufficient bond halts/undercollateralizes the month. |
+| USDC transfer | Usually | Circle can freeze if the token pauses or a recipient is blacklisted; this is an external issuer dependency, not a founder action. |
+| UI / notifications | Not necessarily | A dead frontend or notification service can make users miss deadlines, though direct contract calls should remain possible. |
+| Emergency intervention | No, by design | An admin pause, upgrade, member replacement, or discretionary recovery needs its key holders. Avoid these for normal operation; use a timelocked 2-of-2 multisig only for true emergencies. |
+
+Six weeks spans roughly one or two settlement windows. For currently running
+circles, inspect each deployed version now: `settle`/`advance` must be public,
+the next two timestamps must be on-chain, enough default collateral and keeper
+reserve must exist, and no upcoming action may require an owner signature. If
+any check fails, they will not reliably run unattended.
+
+## Before leaving
+
+1. Run a fork test covering: full payment; one first-month default; a default
+   after earlier pots were paid; default by the scheduled recipient; repeated
+   calls; late payments; and USDC transfer failure. Assert each eligible
+   recipient's 1,200-USDC amount and that funds cannot be double-paid.
+2. Deploy a permissionless keeper (and ideally two independent ones), but give
+   all members a direct settlement link and instructions. Fund gas/reward
+   reserve for at least two periods.
+3. Simulate the next two real settlement transactions against the deployed
+   contract, including USDC allowances/balances and recipient addresses.
+4. Publish the exact forfeiture, skipped-slot, cancellation, and USDC
+   blacklist policies before enrollment. Do not launch until every active
+   circle is either fully collateralized or explicitly variable-payout.
+5. Put any unavoidable admin role behind a 2-of-2 multisig plus timelock and
+   publish a break-glass runbook. This does not make it autonomous; it only
+   makes emergency control safer while both builders are away.

apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md
diff --git a/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..908b19c7562df3e83c76ab33b3098cb6c29eeca4
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md
@@ -0,0 +1,126 @@
+# Autonomous USDC susu
+
+## Decision
+
+An already-running circle keeps working during a six-week absence **only if its
+rules and settlement are already on-chain and every required action is either
+member-initiated or callable by anyone**. A smart contract does not wake up at
+month end: it needs a transaction. It can be autonomous in authority, but not
+in execution.
+
+Do not make a founder wallet the only account that can collect, declare a
+default, advance a month, or pay the recipient. That design stops at the first
+such action while both founders are away. A hosted backend/cron job is also a
+single point of failure unless an ordinary member can complete the same action
+on-chain.
+
+## Rules encoded at creation
+
+Each `Circle` stores immutable:
+
+- exactly 12 unique member addresses;
+- `100_000_000` USDC contribution (USDC uses six decimals);
+- a fixed, ordered list of the 12 payout addresses;
+- start time, 30-day period length, payment deadline, and USDC token address;
+- its default and forfeiture policy.
+
+The circle may start only after all 12 members have accepted these exact terms.
+No owner can replace a member, reorder turns, change the token, or change an
+active circle's dates. The factory can create circles, but should not have a
+withdrawal path from them.
+
+Use a small state machine:
+
+```
+Funding -> Active(period 0..11) -> Finalized
+                 |                    
+                 -> Cancelled (only before any payout)
+```
+
+`pay(circleId, period, amount, permit)` transfers 100 USDC directly into the
+circle and records that member's payment once. Accept EIP-2612/Permit2 data as
+a convenience, but retain a normal prior approval path. Never rely on a wallet
+signature to pull funds after its expiry.
+
+After the payment deadline, `settle(circleId)` is **permissionless**. It:
+
+1. records every unpaid active member as defaulted;
+2. takes the required 100-USDC make-whole amount from each defaulted member's
+   locked security balance for every remaining payout period other than that
+   member's forfeited slot;
+3. transfers the 1,200-USDC pot to the scheduled, eligible recipient, or puts
+   it in a `forfeiturePool` when that scheduled recipient has defaulted;
+4. advances to the next fixed period exactly once.
+
+Any member, a public keeper, or a bot may submit this transaction and receive a
+bounded caller fee paid from a pre-funded operations reserve. The fee gives
+someone a reason to call it, but correctness must not depend on that someone;
+the app should expose a “settle now” button to everyone. Protect settlement
+with checks-effects-interactions, `nonReentrant`, exact period/deadline checks,
+and a `settled[period]` guard.
+
+## The important solvency constraint
+
+The proposed default rule cannot be funded by “earlier contributions” alone.
+Once an earlier 1,200-USDC pot was transferred to its recipient, those USDC no
+longer exist in the contract to cover a later missed 100-USDC payment. This is
+especially obvious when a member misses the first payment: they have made no
+earlier contribution to seize.
+
+To promise every on-time recipient 1,200 USDC, require collateral before the
+circle activates. The cleanest monthly-payment implementation is a
+**1,100-USDC locked member bond plus the current 100-USDC payment** (or simply
+pre-fund all 1,200 USDC). Payment must be collected before a recipient can be
+paid. On a first missed payment the contract marks the member permanently
+defaulted and draws 100 USDC of their bond for every later eligible payout.
+There can be at most 11 such payouts: if their own slot is still ahead, it is
+forfeited; if it has passed, their current-month payment had already been
+collected before their payout. Thus the 1,100-USDC bond covers the worst case.
+
+If forcing a 1,100-USDC bond defeats the product, then change the promise
+explicitly: a month with a missing payer distributes the amount actually
+collected (for example, 1,100 USDC). It is unsafe to advertise a guaranteed
+1,200-USDC payout without collateral, insurance, or a sponsor.
+
+“Forfeit their turn” also needs a rule for the defaulting member's scheduled
+month. Recommended rule: their original slot is skipped, no other member gets
+a second turn, and its fully funded 1,200-USDC pot goes to `forfeiturePool` for
+pro-rata distribution at finalization to members who fulfilled all
+obligations. This preserves the immutable order and one-turn maximum. Document
+it in the acceptance text; it is a material economic choice, not an
+implementation detail.
+
+## Six-week absence: what works and what breaks
+
+| Component | Works while we are away? | Requirement / failure mode |
+| --- | --- | --- |
+| Member payment | Yes, if members submit `pay` before deadline | The contract cannot move USDC from a wallet without valid allowance/permit and balance. Late/nonpayment triggers the coded default rule. |
+| Monthly payout | Yes, if `settle` is public | Someone must send the transaction after deadline. A keeper failure merely delays settlement if any member can call it. |
+| Default handling | Yes, if deterministic and collateralized | An owner-only “mark default” function, subjective disputes, or insufficient bond halts/undercollateralizes the month. |
+| USDC transfer | Usually | Circle can freeze if the token pauses or a recipient is blacklisted; this is an external issuer dependency, not a founder action. |
+| UI / notifications | Not necessarily | A dead frontend or notification service can make users miss deadlines, though direct contract calls should remain possible. |
+| Emergency intervention | No, by design | An admin pause, upgrade, member replacement, or discretionary recovery needs its key holders. Avoid these for normal operation; use a timelocked 2-of-2 multisig only for true emergencies. |
+
+Six weeks spans roughly one or two settlement windows. For currently running
+circles, inspect each deployed version now: `settle`/`advance` must be public,
+the next two timestamps must be on-chain, enough default collateral and keeper
+reserve must exist, and no upcoming action may require an owner signature. If
+any check fails, they will not reliably run unattended.
+
+## Before leaving
+
+1. Run a fork test covering: full payment; one first-month default; a default
+   after earlier pots were paid; default by the scheduled recipient; repeated
+   calls; late payments; and USDC transfer failure. Assert each eligible
+   recipient's 1,200-USDC amount and that funds cannot be double-paid.
+2. Deploy a permissionless keeper (and ideally two independent ones), but give
+   all members a direct settlement link and instructions. Fund gas/reward
+   reserve for at least two periods.
+3. Simulate the next two real settlement transactions against the deployed
+   contract, including USDC allowances/balances and recipient addresses.
+4. Publish the exact forfeiture, skipped-slot, cancellation, and USDC
+   blacklist policies before enrollment. Do not launch until every active
+   circle is either fully collateralized or explicitly variable-payout.
+5. Put any unavoidable admin role behind a 2-of-2 multisig plus timelock and
+   publish a break-glass runbook. This does not make it autonomous; it only
+   makes emergency control safer while both builders are away.

diff --git a/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..908b19c7562df3e83c76ab33b3098cb6c29eeca4
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md
@@ -0,0 +1,126 @@
+# Autonomous USDC susu
+
+## Decision
+
+An already-running circle keeps working during a six-week absence **only if its
+rules and settlement are already on-chain and every required action is either
+member-initiated or callable by anyone**. A smart contract does not wake up at
+month end: it needs a transaction. It can be autonomous in authority, but not
+in execution.
+
+Do not make a founder wallet the only account that can collect, declare a
+default, advance a month, or pay the recipient. That design stops at the first
+such action while both founders are away. A hosted backend/cron job is also a
+single point of failure unless an ordinary member can complete the same action
+on-chain.
+
+## Rules encoded at creation
+
+Each `Circle` stores immutable:
+
+- exactly 12 unique member addresses;
+- `100_000_000` USDC contribution (USDC uses six decimals);
+- a fixed, ordered list of the 12 payout addresses;
+- start time, 30-day period length, payment deadline, and USDC token address;
+- its default and forfeiture policy.
+
+The circle may start only after all 12 members have accepted these exact terms.
+No owner can replace a member, reorder turns, change the token, or change an
+active circle's dates. The factory can create circles, but should not have a
+withdrawal path from them.
+
+Use a small state machine:
+
+```
+Funding -> Active(period 0..11) -> Finalized
+                 |                    
+                 -> Cancelled (only before any payout)
+```
+
+`pay(circleId, period, amount, permit)` transfers 100 USDC directly into the
+circle and records that member's payment once. Accept EIP-2612/Permit2 data as
+a convenience, but retain a normal prior approval path. Never rely on a wallet
+signature to pull funds after its expiry.
+
+After the payment deadline, `settle(circleId)` is **permissionless**. It:
+
+1. records every unpaid active member as defaulted;
+2. takes the required 100-USDC make-whole amount from each defaulted member's
+   locked security balance for every remaining payout period other than that
+   member's forfeited slot;
+3. transfers the 1,200-USDC pot to the scheduled, eligible recipient, or puts
+   it in a `forfeiturePool` when that scheduled recipient has defaulted;
+4. advances to the next fixed period exactly once.
+
+Any member, a public keeper, or a bot may submit this transaction and receive a
+bounded caller fee paid from a pre-funded operations reserve. The fee gives
+someone a reason to call it, but correctness must not depend on that someone;
+the app should expose a “settle now” button to everyone. Protect settlement
+with checks-effects-interactions, `nonReentrant`, exact period/deadline checks,
+and a `settled[period]` guard.
+
+## The important solvency constraint
+
+The proposed default rule cannot be funded by “earlier contributions” alone.
+Once an earlier 1,200-USDC pot was transferred to its recipient, those USDC no
+longer exist in the contract to cover a later missed 100-USDC payment. This is
+especially obvious when a member misses the first payment: they have made no
+earlier contribution to seize.
+
+To promise every on-time recipient 1,200 USDC, require collateral before the
+circle activates. The cleanest monthly-payment implementation is a
+**1,100-USDC locked member bond plus the current 100-USDC payment** (or simply
+pre-fund all 1,200 USDC). Payment must be collected before a recipient can be
+paid. On a first missed payment the contract marks the member permanently
+defaulted and draws 100 USDC of their bond for every later eligible payout.
+There can be at most 11 such payouts: if their own slot is still ahead, it is
+forfeited; if it has passed, their current-month payment had already been
+collected before their payout. Thus the 1,100-USDC bond covers the worst case.
+
+If forcing a 1,100-USDC bond defeats the product, then change the promise
+explicitly: a month with a missing payer distributes the amount actually
+collected (for example, 1,100 USDC). It is unsafe to advertise a guaranteed
+1,200-USDC payout without collateral, insurance, or a sponsor.
+
+“Forfeit their turn” also needs a rule for the defaulting member's scheduled
+month. Recommended rule: their original slot is skipped, no other member gets
+a second turn, and its fully funded 1,200-USDC pot goes to `forfeiturePool` for
+pro-rata distribution at finalization to members who fulfilled all
+obligations. This preserves the immutable order and one-turn maximum. Document
+it in the acceptance text; it is a material economic choice, not an
+implementation detail.
+
+## Six-week absence: what works and what breaks
+
+| Component | Works while we are away? | Requirement / failure mode |
+| --- | --- | --- |
+| Member payment | Yes, if members submit `pay` before deadline | The contract cannot move USDC from a wallet without valid allowance/permit and balance. Late/nonpayment triggers the coded default rule. |
+| Monthly payout | Yes, if `settle` is public | Someone must send the transaction after deadline. A keeper failure merely delays settlement if any member can call it. |
+| Default handling | Yes, if deterministic and collateralized | An owner-only “mark default” function, subjective disputes, or insufficient bond halts/undercollateralizes the month. |
+| USDC transfer | Usually | Circle can freeze if the token pauses or a recipient is blacklisted; this is an external issuer dependency, not a founder action. |
+| UI / notifications | Not necessarily | A dead frontend or notification service can make users miss deadlines, though direct contract calls should remain possible. |
+| Emergency intervention | No, by design | An admin pause, upgrade, member replacement, or discretionary recovery needs its key holders. Avoid these for normal operation; use a timelocked 2-of-2 multisig only for true emergencies. |
+
+Six weeks spans roughly one or two settlement windows. For currently running
+circles, inspect each deployed version now: `settle`/`advance` must be public,
+the next two timestamps must be on-chain, enough default collateral and keeper
+reserve must exist, and no upcoming action may require an owner signature. If
+any check fails, they will not reliably run unattended.
+
+## Before leaving
+
+1. Run a fork test covering: full payment; one first-month default; a default
+   after earlier pots were paid; default by the scheduled recipient; repeated
+   calls; late payments; and USDC transfer failure. Assert each eligible
+   recipient's 1,200-USDC amount and that funds cannot be double-paid.
+2. Deploy a permissionless keeper (and ideally two independent ones), but give
+   all members a direct settlement link and instructions. Fund gas/reward
+   reserve for at least two periods.
+3. Simulate the next two real settlement transactions against the deployed
+   contract, including USDC allowances/balances and recipient addresses.
+4. Publish the exact forfeiture, skipped-slot, cancellation, and USDC
+   blacklist policies before enrollment. Do not launch until every active
+   circle is either fully collateralized or explicitly variable-payout.
+5. Put any unavoidable admin role behind a 2-of-2 multisig plus timelock and
+   publish a break-glass runbook. This does not make it autonomous; it only
+   makes emergency control safer while both builders are away.

codex
Wrote [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md).

Key conclusion: unattended operation requires public, deterministic settlement plus member-accessible calls. Contracts need a transaction to advance; owner-only actions, uncollateralized defaults, or a sole backend/keeper will break while you’re away.
diff --git a/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md b/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..908b19c7562df3e83c76ab33b3098cb6c29eeca4
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md
@@ -0,0 +1,126 @@
+# Autonomous USDC susu
+
+## Decision
+
+An already-running circle keeps working during a six-week absence **only if its
+rules and settlement are already on-chain and every required action is either
+member-initiated or callable by anyone**. A smart contract does not wake up at
+month end: it needs a transaction. It can be autonomous in authority, but not
+in execution.
+
+Do not make a founder wallet the only account that can collect, declare a
+default, advance a month, or pay the recipient. That design stops at the first
+such action while both founders are away. A hosted backend/cron job is also a
+single point of failure unless an ordinary member can complete the same action
+on-chain.
+
+## Rules encoded at creation
+
+Each `Circle` stores immutable:
+
+- exactly 12 unique member addresses;
+- `100_000_000` USDC contribution (USDC uses six decimals);
+- a fixed, ordered list of the 12 payout addresses;
+- start time, 30-day period length, payment deadline, and USDC token address;
+- its default and forfeiture policy.
+
+The circle may start only after all 12 members have accepted these exact terms.
+No owner can replace a member, reorder turns, change the token, or change an
+active circle's dates. The factory can create circles, but should not have a
+withdrawal path from them.
+
+Use a small state machine:
+
+```
+Funding -> Active(period 0..11) -> Finalized
+                 |                    
+                 -> Cancelled (only before any payout)
+```
+
+`pay(circleId, period, amount, permit)` transfers 100 USDC directly into the
+circle and records that member's payment once. Accept EIP-2612/Permit2 data as
+a convenience, but retain a normal prior approval path. Never rely on a wallet
+signature to pull funds after its expiry.
+
+After the payment deadline, `settle(circleId)` is **permissionless**. It:
+
+1. records every unpaid active member as defaulted;
+2. takes the required 100-USDC make-whole amount from each defaulted member's
+   locked security balance for every remaining payout period other than that
+   member's forfeited slot;
+3. transfers the 1,200-USDC pot to the scheduled, eligible recipient, or puts
+   it in a `forfeiturePool` when that scheduled recipient has defaulted;
+4. advances to the next fixed period exactly once.
+
+Any member, a public keeper, or a bot may submit this transaction and receive a
+bounded caller fee paid from a pre-funded operations reserve. The fee gives
+someone a reason to call it, but correctness must not depend on that someone;
+the app should expose a “settle now” button to everyone. Protect settlement
+with checks-effects-interactions, `nonReentrant`, exact period/deadline checks,
+and a `settled[period]` guard.
+
+## The important solvency constraint
+
+The proposed default rule cannot be funded by “earlier contributions” alone.
+Once an earlier 1,200-USDC pot was transferred to its recipient, those USDC no
+longer exist in the contract to cover a later missed 100-USDC payment. This is
+especially obvious when a member misses the first payment: they have made no
+earlier contribution to seize.
+
+To promise every on-time recipient 1,200 USDC, require collateral before the
+circle activates. The cleanest monthly-payment implementation is a
+**1,100-USDC locked member bond plus the current 100-USDC payment** (or simply
+pre-fund all 1,200 USDC). Payment must be collected before a recipient can be
+paid. On a first missed payment the contract marks the member permanently
+defaulted and draws 100 USDC of their bond for every later eligible payout.
+There can be at most 11 such payouts: if their own slot is still ahead, it is
+forfeited; if it has passed, their current-month payment had already been
+collected before their payout. Thus the 1,100-USDC bond covers the worst case.
+
+If forcing a 1,100-USDC bond defeats the product, then change the promise
+explicitly: a month with a missing payer distributes the amount actually
+collected (for example, 1,100 USDC). It is unsafe to advertise a guaranteed
+1,200-USDC payout without collateral, insurance, or a sponsor.
+
+“Forfeit their turn” also needs a rule for the defaulting member's scheduled
+month. Recommended rule: their original slot is skipped, no other member gets
+a second turn, and its fully funded 1,200-USDC pot goes to `forfeiturePool` for
+pro-rata distribution at finalization to members who fulfilled all
+obligations. This preserves the immutable order and one-turn maximum. Document
+it in the acceptance text; it is a material economic choice, not an
+implementation detail.
+
+## Six-week absence: what works and what breaks
+
+| Component | Works while we are away? | Requirement / failure mode |
+| --- | --- | --- |
+| Member payment | Yes, if members submit `pay` before deadline | The contract cannot move USDC from a wallet without valid allowance/permit and balance. Late/nonpayment triggers the coded default rule. |
+| Monthly payout | Yes, if `settle` is public | Someone must send the transaction after deadline. A keeper failure merely delays settlement if any member can call it. |
+| Default handling | Yes, if deterministic and collateralized | An owner-only “mark default” function, subjective disputes, or insufficient bond halts/undercollateralizes the month. |
+| USDC transfer | Usually | Circle can freeze if the token pauses or a recipient is blacklisted; this is an external issuer dependency, not a founder action. |
+| UI / notifications | Not necessarily | A dead frontend or notification service can make users miss deadlines, though direct contract calls should remain possible. |
+| Emergency intervention | No, by design | An admin pause, upgrade, member replacement, or discretionary recovery needs its key holders. Avoid these for normal operation; use a timelocked 2-of-2 multisig only for true emergencies. |
+
+Six weeks spans roughly one or two settlement windows. For currently running
+circles, inspect each deployed version now: `settle`/`advance` must be public,
+the next two timestamps must be on-chain, enough default collateral and keeper
+reserve must exist, and no upcoming action may require an owner signature. If
+any check fails, they will not reliably run unattended.
+
+## Before leaving
+
+1. Run a fork test covering: full payment; one first-month default; a default
+   after earlier pots were paid; default by the scheduled recipient; repeated
+   calls; late payments; and USDC transfer failure. Assert each eligible
+   recipient's 1,200-USDC amount and that funds cannot be double-paid.
+2. Deploy a permissionless keeper (and ideally two independent ones), but give
+   all members a direct settlement link and instructions. Fund gas/reward
+   reserve for at least two periods.
+3. Simulate the next two real settlement transactions against the deployed
+   contract, including USDC allowances/balances and recipient addresses.
+4. Publish the exact forfeiture, skipped-slot, cancellation, and USDC
+   blacklist policies before enrollment. Do not launch until every active
+   circle is either fully collateralized or explicitly variable-payout.
+5. Put any unavoidable admin role behind a 2-of-2 multisig plus timelock and
+   publish a break-glass runbook. This does not make it autonomous; it only
+   makes emergency control safer while both builders are away.

tokens used
24,461
Wrote [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-003/2026-07-30T200035Z-codex-no-skill-1/workspace/plan.md).

Key conclusion: unattended operation requires public, deterministic settlement plus member-accessible calls. Contracts need a transaction to advance; owner-only actions, uncollateralized defaults, or a sole backend/keeper will break while you’re away.
