OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-003/2026-08-28T144237Z-codex-no-skill-1/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a048d2-9d6d-7f02-ae90-c2433b08357e
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

2026-08-28T14:42:37.804040Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a048d2-9d6d-7f02-ae90-c2433b08357e.tmp-1787928157553657539: line 2547: syntax error near unexpected token `('

codex
I’ll inspect the existing contracts and project notes first, then trace the full monthly lifecycle—payments, default handling, recipient forfeiture, and anything that depends on an operator transaction. I’ll write the resulting design and six-week continuity assessment directly into `plan.md`.
exec
/bin/bash -lc "pwd && rg --files -g '"'!*node_modules*'"' -g '"'!*.lock'"' | sed -n '1,200p'" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-003/2026-08-28T144237Z-codex-no-skill-1/workspace
 succeeded in 7ms:
TASK.md

exec
/bin/bash -lc "sed -n '1,240p' TASK.md && find . -maxdepth 3 -type f -not -path './.git/*' -print" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-003/2026-08-28T144237Z-codex-no-skill-1/workspace
 succeeded in 11ms:
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
./TASK.md

codex
The central issue is economic, not just automation: once a $1,200 pot has been paid out, prior monthly contributions are no longer in the contract, so they cannot later cover a missed payment. The design therefore needs explicit locked collateral (or an external guarantor/reserve), and it must separate that solvency requirement from the question of who submits month-end transactions. I’m capturing both points, including the exact failure modes during a six-week unattended period.
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-003/2026-08-28T144237Z-codex-no-skill-1/workspace/plan.md
diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..16c72e4117f39d5e323214f22b35c50db6ca5add
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,99 @@
+# Onchain susu: contract design and unattended-operation plan
+
+## Bottom line
+
+A Solidity contract does not wake up when a month ends. A running circle can survive the builders being away only if (1) members can pay without an admin, (2) advancing/settling a round is permissionless and is actually called by a member, recipient, or funded automation service, and (3) enough assets are already locked to cover defaults. An admin-only `closeRound`, an unfunded/offline keeper, a paused contract, or a design that treats already-paid-out contributions as collateral will stop or underfund the circle.
+
+Six weeks is therefore safe for the design below: members submit their own payments, anyone can settle after the deadline, and a recipient has a direct financial reason to do so. Automation is useful redundancy, not a trusted dependency. If existing deployed circles do not already have those properties, they cannot be repaired merely by leaving a bot running; see the pre-departure checklist and migration cases below.
+
+## First resolve the economic contradiction
+
+Twelve monthly payments of 100 USDC exactly fund a 1,200 USDC payout. After each payout, the contract has no surplus. A member's “earlier contributions” have already helped fund earlier recipients and are not still available to cover that member's future missed payment.
+
+Consequently, guaranteed 1,200 USDC payouts require one of:
+
+- default collateral locked in addition to monthly contributions;
+- an external guarantor/credit line;
+- smaller or delayed payouts when somebody defaults.
+
+The recommended version uses collateral. Each member locks 1,200 USDC at admission (or, less conservatively, the maximum value of their obligations that remain after they receive the pot). Each successful 100 USDC monthly payment unlocks 100 USDC of that member's collateral after settlement. On a missed payment, settlement takes 100 USDC from their collateral instead. This preserves a full pot even if a member receives first and then stops paying. Requiring only “contributions made so far” does not solve that worst case.
+
+The product statement also needs one policy clarified: “everyone gets exactly one turn” conflicts with “a defaulter forfeits their turn.” The implementable interpretation used here is: every member starts with one scheduled entitlement; a member who defaults before receiving loses it, so every *non-defaulting* member receives exactly once. A forfeited pot must not silently be awarded twice. Recommended handling is to keep the twelve fixed round slots and, in a forfeited recipient's slot, distribute that round's net assets pro rata to members who have not defaulted after the circle ends (or send them to an explicitly named community beneficiary). If the intended rule is instead to promote the next eligible recipient, that changes timing/order and must be specified and tested separately.
+
+## Contract shape
+
+Deploy one small immutable `Circle` per group from a factory (or minimal proxies if deployment cost matters). Avoid an upgrade/admin dependency for active circles. Constructor/initializer parameters are immutable after activation:
+
+- the exact USDC token address and its decimals-aware amount (`100_000_000` for six-decimal USDC);
+- exactly twelve unique, nonzero member addresses in payout order;
+- `startTime`, round length, and payment/grace-window length;
+- collateral requirement and the forfeited-pot beneficiary policy;
+- an optional automation address with no exclusive privilege.
+
+Activation is allowed only after all twelve members have deposited the required collateral. Do not accept arbitrary ERC-20s. Use safe transfer wrappers, checks-effects-interactions, a reentrancy guard, and balance-delta checks so accounting cannot claim more USDC than was actually received. Keep accounting in integer USDC base units.
+
+Core state per circle:
+
+- lifecycle: `Funding`, `Active`, `Complete`, or emergency-paused;
+- current round, fixed recipient array, and absolute deadlines derived from the fixed start time rather than from the last caller's timestamp;
+- per member: collateral remaining, rounds paid bitmap, defaulted/forfeited flag, and payout-received flag;
+- aggregate contribution balance, collateral balance, forfeited-pot balance, and claimable refunds;
+- settled bitmap so settlement is idempotent and no round can pay twice.
+
+Core functions:
+
+1. `depositCollateral()` transfers collateral before activation. A member may withdraw only if activation fails by a stated funding deadline.
+2. `pay(round)` is called by a member during that round's payment window. It transfers exactly 100 USDC and marks that member paid. It rejects duplicate, early, late, or wrong-round payments. Supporting EIP-2612/Permit2 can improve UX, but must be optional and carefully scoped; an allowance alone does not execute a payment.
+3. `settle(round)` is callable by **any address** after the payment deadline. It is not `onlyOwner` and must not require the automation address. For each unpaid member it moves 100 USDC from locked collateral into the round pot, marks the member defaulted, and marks an as-yet-unreceived entitlement forfeited. It then records the round settled before transferring funds.
+4. If the scheduled recipient is eligible, settlement transfers exactly 1,200 USDC to them. Prefer direct transfer with a fallback `claimPayout()` credit if a transfer can fail, so one bad recipient cannot block all later rounds. If that recipient had forfeited, credit the 1,200 USDC to the explicit forfeited-pot bucket rather than guessing a replacement.
+5. `settleOverdue(maxRounds)` allows catch-up of several elapsed rounds in bounded chunks. Each round uses its original absolute deadline. This prevents six weeks of inactivity from permanently wedging the state machine and avoids an unbounded loop.
+6. `claimCollateral()`/`claimSurplus()` use pull payments after completion. A compliant member recovers unlocked collateral; slashed amounts are not withdrawable. Claims remain available indefinitely and do not block circle completion.
+
+Collateral accounting should be expressed as an invariant, not as a loose pooled balance. Before every payout, assets reserved for future obligations must remain at least the sum of all members' unpaid future installments. No admin withdrawal, fee, or forfeited-pot payout may invade that reserve.
+
+## Timing and default semantics
+
+Use explicit Unix timestamps and document UTC dates in the UI. A round has a payment-open time and a deadline. Settlement becomes valid at `deadline` (choose consistently whether equality is late). Chain timestamps can vary slightly, so do not make the boundary minute-sensitive. A multi-day grace window is appropriate for a monthly product.
+
+Default should be objective: failure to have a confirmed `pay(round)` transaction by the onchain deadline. A failed wallet transaction, insufficient allowance, bridge delay, sequencer outage, or unavailable frontend is otherwise still a default. Provide an alternate static frontend and publish verified contract addresses/ABIs so members can transact without the builders' site.
+
+Decide whether one miss permanently forfeits a future payout, and what happens if the member already received. The recommendation is permanent default status in both cases: collateral continues securing every remaining installment; if they already received, there is no entitlement left to forfeit. Never attempt to claw back an earlier pot.
+
+## Will already-running circles work for the next six weeks?
+
+This is a property of the **deployed bytecode and current onchain state**, not of the intended design. With no contracts or deployment addresses in this repository, it cannot be asserted that existing circles are safe. Check each deployed circle against the following decision table before leaving:
+
+| Existing behavior/state | What happens while both builders are away | Required action before leaving |
+|---|---|---|
+| `settle`/`advance` is admin-only and builders hold the only key | Payments may accumulate, but the deadline does nothing and recipients are not paid; later rounds may also reject payments because `currentRound` never advances | Transfer the operational role to a well-secured multisig with available signers, or—if upgradeable—ship and audit a permissionless settlement upgrade. Otherwise migrate/refund before leaving |
+| Settlement is permissionless but nobody calls it | The circle stalls at the first deadline; it may catch up only if the code permits late/multi-round settlement | Fund and test automation **and** document that any member/recipient can call. Add bounded catch-up if upgradeable; otherwise arrange a caller for each deadline |
+| A keeper is the only practical caller | It stops on depleted gas/subscription balance, expired credentials, RPC failure, rate limits, or a reverted transaction | Pre-fund beyond six weeks, configure alerts and a second independent caller, and run a real end-to-end test. Do not make keeper identity privileged |
+| Payments depend on a builder-run backend or relayer | Members cannot pay; after the grace period they are marked in default | Enable direct member transactions and publish a fallback UI/instructions; fund redundant relaying only as convenience |
+| Contract relies on ERC-20 allowance to “auto-debit” | Nothing is debited automatically; allowance authorizes a later transaction but does not create one | Ensure a public/automated `collect` call exists and is funded, or require members to call `pay` |
+| No collateral/guarantee is currently locked | The first missed payment makes the available pot less than 1,200 USDC (or causes exact-payout settlement to revert). Earlier paid-out contributions cannot cover it | Top up a contract-supported reserve before activation/next round. If bytecode cannot account for it safely, migrate or disclose that payouts are not guaranteed; merely sending USDC to the contract may strand it |
+| Contract processes all overdue rounds in one unbounded loop | Catch-up can exceed block gas and become impossible as backlog grows | Add bounded `settleOverdue(maxRounds)` if upgradeable; otherwise schedule settlement every round and test worst-case gas now |
+| Pauser/admin can freeze active circles and key is unavailable | An accidental/existing pause cannot be cleared; compromised admin can stop progress | Verify unpaused state, use a multisig with available signers, and narrowly scope pause powers. Claims/refunds should ideally remain callable while paused |
+| Upgradeable proxy depends on one builder key | A key loss/compromise is a major risk, though absence alone does not stop immutable logic | Move ownership to a tested multisig/timelock; do not perform an unreviewed upgrade immediately before departure |
+| Circle is already fully funded, deadlines are absolute, member payment and bounded settlement are permissionless, collateral is sufficient, and claims are pull-based | It continues without either builder. Calls still need members or automation, but no special builder action is required | Publish runbook and addresses, test one settlement path, monitor alerts, then leave it alone |
+
+Six weeks likely crosses at least one monthly deadline and can cross two depending on departure date. Test the exact timestamps for every active circle rather than assuming “one month.” Also verify chain-native gas balances for the automation/caller, USDC balances and allowances for members, reserve sufficiency, current round, pause state, and emitted events.
+
+## Pre-departure acceptance test
+
+Run this against a fork at each active deployment's current state:
+
+1. Record proxy implementation, admin/owner/pauser roles, current round, next two deadlines, balances, and liabilities.
+2. Advance time past one deadline with one unpaid member. Confirm anyone can settle, exactly 1,200 USDC is paid, exactly 100 USDC collateral is slashed, and the missed member's correct entitlement is forfeited.
+3. Advance through a second deadline with no builder/admin transactions. Confirm bounded catch-up and that round order/deadlines do not drift.
+4. Simulate keeper failure and use an ordinary fresh address to settle.
+5. Simulate a recipient transfer/claim failure and confirm later rounds remain live.
+6. Assert after every action: no double payment, no double settlement, each eligible recipient gets at most one pot, total token assets equal accounted liabilities, and future-obligation collateral remains untouched.
+7. Test completion and collateral/surplus claims, including a member who paid, one who defaulted before their turn, and one who defaulted after receiving.
+
+If any deployed circle fails these tests and cannot be safely upgraded, the honest options before departure are to appoint an available operator where that is sufficient, or stop accepting new money and execute the contract's documented refund/migration path. Do not promise autonomous operation based only on a keeper dashboard or on funds visible at the contract address.
+
+## Operational runbook
+
+Emit indexed events for payment, default, forfeiture, settlement, payout credit/claim, collateral slash/refund, pause, and configuration at activation. Monitor: deadline approaching with unpaid members, deadline passed but unsettled, automation gas low, reserve below liabilities, paused state, and unexpected admin/implementation changes. Alerts must go to someone who is actually available during the six weeks.
+
+Publish, before leaving, the chain ID, verified addresses, exact deadlines, member payment instructions, public settlement instructions, fallback RPC/frontend, automation status, and escalation contact. No runbook can compensate for admin-only bytecode when the only admins are away; that case needs an onchain role change, upgrade, or migration before departure.

diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..16c72e4117f39d5e323214f22b35c50db6ca5add
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,99 @@
+# Onchain susu: contract design and unattended-operation plan
+
+## Bottom line
+
+A Solidity contract does not wake up when a month ends. A running circle can survive the builders being away only if (1) members can pay without an admin, (2) advancing/settling a round is permissionless and is actually called by a member, recipient, or funded automation service, and (3) enough assets are already locked to cover defaults. An admin-only `closeRound`, an unfunded/offline keeper, a paused contract, or a design that treats already-paid-out contributions as collateral will stop or underfund the circle.
+
+Six weeks is therefore safe for the design below: members submit their own payments, anyone can settle after the deadline, and a recipient has a direct financial reason to do so. Automation is useful redundancy, not a trusted dependency. If existing deployed circles do not already have those properties, they cannot be repaired merely by leaving a bot running; see the pre-departure checklist and migration cases below.
+
+## First resolve the economic contradiction
+
+Twelve monthly payments of 100 USDC exactly fund a 1,200 USDC payout. After each payout, the contract has no surplus. A member's “earlier contributions” have already helped fund earlier recipients and are not still available to cover that member's future missed payment.
+
+Consequently, guaranteed 1,200 USDC payouts require one of:
+
+- default collateral locked in addition to monthly contributions;
+- an external guarantor/credit line;
+- smaller or delayed payouts when somebody defaults.
+
+The recommended version uses collateral. Each member locks 1,200 USDC at admission (or, less conservatively, the maximum value of their obligations that remain after they receive the pot). Each successful 100 USDC monthly payment unlocks 100 USDC of that member's collateral after settlement. On a missed payment, settlement takes 100 USDC from their collateral instead. This preserves a full pot even if a member receives first and then stops paying. Requiring only “contributions made so far” does not solve that worst case.
+
+The product statement also needs one policy clarified: “everyone gets exactly one turn” conflicts with “a defaulter forfeits their turn.” The implementable interpretation used here is: every member starts with one scheduled entitlement; a member who defaults before receiving loses it, so every *non-defaulting* member receives exactly once. A forfeited pot must not silently be awarded twice. Recommended handling is to keep the twelve fixed round slots and, in a forfeited recipient's slot, distribute that round's net assets pro rata to members who have not defaulted after the circle ends (or send them to an explicitly named community beneficiary). If the intended rule is instead to promote the next eligible recipient, that changes timing/order and must be specified and tested separately.
+
+## Contract shape
+
+Deploy one small immutable `Circle` per group from a factory (or minimal proxies if deployment cost matters). Avoid an upgrade/admin dependency for active circles. Constructor/initializer parameters are immutable after activation:
+
+- the exact USDC token address and its decimals-aware amount (`100_000_000` for six-decimal USDC);
+- exactly twelve unique, nonzero member addresses in payout order;
+- `startTime`, round length, and payment/grace-window length;
+- collateral requirement and the forfeited-pot beneficiary policy;
+- an optional automation address with no exclusive privilege.
+
+Activation is allowed only after all twelve members have deposited the required collateral. Do not accept arbitrary ERC-20s. Use safe transfer wrappers, checks-effects-interactions, a reentrancy guard, and balance-delta checks so accounting cannot claim more USDC than was actually received. Keep accounting in integer USDC base units.
+
+Core state per circle:
+
+- lifecycle: `Funding`, `Active`, `Complete`, or emergency-paused;
+- current round, fixed recipient array, and absolute deadlines derived from the fixed start time rather than from the last caller's timestamp;
+- per member: collateral remaining, rounds paid bitmap, defaulted/forfeited flag, and payout-received flag;
+- aggregate contribution balance, collateral balance, forfeited-pot balance, and claimable refunds;
+- settled bitmap so settlement is idempotent and no round can pay twice.
+
+Core functions:
+
+1. `depositCollateral()` transfers collateral before activation. A member may withdraw only if activation fails by a stated funding deadline.
+2. `pay(round)` is called by a member during that round's payment window. It transfers exactly 100 USDC and marks that member paid. It rejects duplicate, early, late, or wrong-round payments. Supporting EIP-2612/Permit2 can improve UX, but must be optional and carefully scoped; an allowance alone does not execute a payment.
+3. `settle(round)` is callable by **any address** after the payment deadline. It is not `onlyOwner` and must not require the automation address. For each unpaid member it moves 100 USDC from locked collateral into the round pot, marks the member defaulted, and marks an as-yet-unreceived entitlement forfeited. It then records the round settled before transferring funds.
+4. If the scheduled recipient is eligible, settlement transfers exactly 1,200 USDC to them. Prefer direct transfer with a fallback `claimPayout()` credit if a transfer can fail, so one bad recipient cannot block all later rounds. If that recipient had forfeited, credit the 1,200 USDC to the explicit forfeited-pot bucket rather than guessing a replacement.
+5. `settleOverdue(maxRounds)` allows catch-up of several elapsed rounds in bounded chunks. Each round uses its original absolute deadline. This prevents six weeks of inactivity from permanently wedging the state machine and avoids an unbounded loop.
+6. `claimCollateral()`/`claimSurplus()` use pull payments after completion. A compliant member recovers unlocked collateral; slashed amounts are not withdrawable. Claims remain available indefinitely and do not block circle completion.
+
+Collateral accounting should be expressed as an invariant, not as a loose pooled balance. Before every payout, assets reserved for future obligations must remain at least the sum of all members' unpaid future installments. No admin withdrawal, fee, or forfeited-pot payout may invade that reserve.
+
+## Timing and default semantics
+
+Use explicit Unix timestamps and document UTC dates in the UI. A round has a payment-open time and a deadline. Settlement becomes valid at `deadline` (choose consistently whether equality is late). Chain timestamps can vary slightly, so do not make the boundary minute-sensitive. A multi-day grace window is appropriate for a monthly product.
+
+Default should be objective: failure to have a confirmed `pay(round)` transaction by the onchain deadline. A failed wallet transaction, insufficient allowance, bridge delay, sequencer outage, or unavailable frontend is otherwise still a default. Provide an alternate static frontend and publish verified contract addresses/ABIs so members can transact without the builders' site.
+
+Decide whether one miss permanently forfeits a future payout, and what happens if the member already received. The recommendation is permanent default status in both cases: collateral continues securing every remaining installment; if they already received, there is no entitlement left to forfeit. Never attempt to claw back an earlier pot.
+
+## Will already-running circles work for the next six weeks?
+
+This is a property of the **deployed bytecode and current onchain state**, not of the intended design. With no contracts or deployment addresses in this repository, it cannot be asserted that existing circles are safe. Check each deployed circle against the following decision table before leaving:
+
+| Existing behavior/state | What happens while both builders are away | Required action before leaving |
+|---|---|---|
+| `settle`/`advance` is admin-only and builders hold the only key | Payments may accumulate, but the deadline does nothing and recipients are not paid; later rounds may also reject payments because `currentRound` never advances | Transfer the operational role to a well-secured multisig with available signers, or—if upgradeable—ship and audit a permissionless settlement upgrade. Otherwise migrate/refund before leaving |
+| Settlement is permissionless but nobody calls it | The circle stalls at the first deadline; it may catch up only if the code permits late/multi-round settlement | Fund and test automation **and** document that any member/recipient can call. Add bounded catch-up if upgradeable; otherwise arrange a caller for each deadline |
+| A keeper is the only practical caller | It stops on depleted gas/subscription balance, expired credentials, RPC failure, rate limits, or a reverted transaction | Pre-fund beyond six weeks, configure alerts and a second independent caller, and run a real end-to-end test. Do not make keeper identity privileged |
+| Payments depend on a builder-run backend or relayer | Members cannot pay; after the grace period they are marked in default | Enable direct member transactions and publish a fallback UI/instructions; fund redundant relaying only as convenience |
+| Contract relies on ERC-20 allowance to “auto-debit” | Nothing is debited automatically; allowance authorizes a later transaction but does not create one | Ensure a public/automated `collect` call exists and is funded, or require members to call `pay` |
+| No collateral/guarantee is currently locked | The first missed payment makes the available pot less than 1,200 USDC (or causes exact-payout settlement to revert). Earlier paid-out contributions cannot cover it | Top up a contract-supported reserve before activation/next round. If bytecode cannot account for it safely, migrate or disclose that payouts are not guaranteed; merely sending USDC to the contract may strand it |
+| Contract processes all overdue rounds in one unbounded loop | Catch-up can exceed block gas and become impossible as backlog grows | Add bounded `settleOverdue(maxRounds)` if upgradeable; otherwise schedule settlement every round and test worst-case gas now |
+| Pauser/admin can freeze active circles and key is unavailable | An accidental/existing pause cannot be cleared; compromised admin can stop progress | Verify unpaused state, use a multisig with available signers, and narrowly scope pause powers. Claims/refunds should ideally remain callable while paused |
+| Upgradeable proxy depends on one builder key | A key loss/compromise is a major risk, though absence alone does not stop immutable logic | Move ownership to a tested multisig/timelock; do not perform an unreviewed upgrade immediately before departure |
+| Circle is already fully funded, deadlines are absolute, member payment and bounded settlement are permissionless, collateral is sufficient, and claims are pull-based | It continues without either builder. Calls still need members or automation, but no special builder action is required | Publish runbook and addresses, test one settlement path, monitor alerts, then leave it alone |
+
+Six weeks likely crosses at least one monthly deadline and can cross two depending on departure date. Test the exact timestamps for every active circle rather than assuming “one month.” Also verify chain-native gas balances for the automation/caller, USDC balances and allowances for members, reserve sufficiency, current round, pause state, and emitted events.
+
+## Pre-departure acceptance test
+
+Run this against a fork at each active deployment's current state:
+
+1. Record proxy implementation, admin/owner/pauser roles, current round, next two deadlines, balances, and liabilities.
+2. Advance time past one deadline with one unpaid member. Confirm anyone can settle, exactly 1,200 USDC is paid, exactly 100 USDC collateral is slashed, and the missed member's correct entitlement is forfeited.
+3. Advance through a second deadline with no builder/admin transactions. Confirm bounded catch-up and that round order/deadlines do not drift.
+4. Simulate keeper failure and use an ordinary fresh address to settle.
+5. Simulate a recipient transfer/claim failure and confirm later rounds remain live.
+6. Assert after every action: no double payment, no double settlement, each eligible recipient gets at most one pot, total token assets equal accounted liabilities, and future-obligation collateral remains untouched.
+7. Test completion and collateral/surplus claims, including a member who paid, one who defaulted before their turn, and one who defaulted after receiving.
+
+If any deployed circle fails these tests and cannot be safely upgraded, the honest options before departure are to appoint an available operator where that is sufficient, or stop accepting new money and execute the contract's documented refund/migration path. Do not promise autonomous operation based only on a keeper dashboard or on funds visible at the contract address.
+
+## Operational runbook
+
+Emit indexed events for payment, default, forfeiture, settlement, payout credit/claim, collateral slash/refund, pause, and configuration at activation. Monitor: deadline approaching with unpaid members, deadline passed but unsettled, automation gas low, reserve below liabilities, paused state, and unexpected admin/implementation changes. Alerts must go to someone who is actually available during the six weeks.
+
+Publish, before leaving, the chain ID, verified addresses, exact deadlines, member payment instructions, public settlement instructions, fallback RPC/frontend, automation status, and escalation contact. No runbook can compensate for admin-only bytecode when the only admins are away; that case needs an onchain role change, upgrade, or migration before departure.

exec
/bin/bash -lc "wc -l plan.md && sed -n '1,260p' plan.md && git diff --check && git status --short" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-003/2026-08-28T144237Z-codex-no-skill-1/workspace
 succeeded in 5ms:
?? plan.md

diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..16c72e4117f39d5e323214f22b35c50db6ca5add
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,99 @@
+# Onchain susu: contract design and unattended-operation plan
+
+## Bottom line
+
+A Solidity contract does not wake up when a month ends. A running circle can survive the builders being away only if (1) members can pay without an admin, (2) advancing/settling a round is permissionless and is actually called by a member, recipient, or funded automation service, and (3) enough assets are already locked to cover defaults. An admin-only `closeRound`, an unfunded/offline keeper, a paused contract, or a design that treats already-paid-out contributions as collateral will stop or underfund the circle.
+
+Six weeks is therefore safe for the design below: members submit their own payments, anyone can settle after the deadline, and a recipient has a direct financial reason to do so. Automation is useful redundancy, not a trusted dependency. If existing deployed circles do not already have those properties, they cannot be repaired merely by leaving a bot running; see the pre-departure checklist and migration cases below.
+
+## First resolve the economic contradiction
+
+Twelve monthly payments of 100 USDC exactly fund a 1,200 USDC payout. After each payout, the contract has no surplus. A member's “earlier contributions” have already helped fund earlier recipients and are not still available to cover that member's future missed payment.
+
+Consequently, guaranteed 1,200 USDC payouts require one of:
+
+- default collateral locked in addition to monthly contributions;
+- an external guarantor/credit line;
+- smaller or delayed payouts when somebody defaults.
+
+The recommended version uses collateral. Each member locks 1,200 USDC at admission (or, less conservatively, the maximum value of their obligations that remain after they receive the pot). Each successful 100 USDC monthly payment unlocks 100 USDC of that member's collateral after settlement. On a missed payment, settlement takes 100 USDC from their collateral instead. This preserves a full pot even if a member receives first and then stops paying. Requiring only “contributions made so far” does not solve that worst case.
+
+The product statement also needs one policy clarified: “everyone gets exactly one turn” conflicts with “a defaulter forfeits their turn.” The implementable interpretation used here is: every member starts with one scheduled entitlement; a member who defaults before receiving loses it, so every *non-defaulting* member receives exactly once. A forfeited pot must not silently be awarded twice. Recommended handling is to keep the twelve fixed round slots and, in a forfeited recipient's slot, distribute that round's net assets pro rata to members who have not defaulted after the circle ends (or send them to an explicitly named community beneficiary). If the intended rule is instead to promote the next eligible recipient, that changes timing/order and must be specified and tested separately.
+
+## Contract shape
+
+Deploy one small immutable `Circle` per group from a factory (or minimal proxies if deployment cost matters). Avoid an upgrade/admin dependency for active circles. Constructor/initializer parameters are immutable after activation:
+
+- the exact USDC token address and its decimals-aware amount (`100_000_000` for six-decimal USDC);
+- exactly twelve unique, nonzero member addresses in payout order;
+- `startTime`, round length, and payment/grace-window length;
+- collateral requirement and the forfeited-pot beneficiary policy;
+- an optional automation address with no exclusive privilege.
+
+Activation is allowed only after all twelve members have deposited the required collateral. Do not accept arbitrary ERC-20s. Use safe transfer wrappers, checks-effects-interactions, a reentrancy guard, and balance-delta checks so accounting cannot claim more USDC than was actually received. Keep accounting in integer USDC base units.
+
+Core state per circle:
+
+- lifecycle: `Funding`, `Active`, `Complete`, or emergency-paused;
+- current round, fixed recipient array, and absolute deadlines derived from the fixed start time rather than from the last caller's timestamp;
+- per member: collateral remaining, rounds paid bitmap, defaulted/forfeited flag, and payout-received flag;
+- aggregate contribution balance, collateral balance, forfeited-pot balance, and claimable refunds;
+- settled bitmap so settlement is idempotent and no round can pay twice.
+
+Core functions:
+
+1. `depositCollateral()` transfers collateral before activation. A member may withdraw only if activation fails by a stated funding deadline.
+2. `pay(round)` is called by a member during that round's payment window. It transfers exactly 100 USDC and marks that member paid. It rejects duplicate, early, late, or wrong-round payments. Supporting EIP-2612/Permit2 can improve UX, but must be optional and carefully scoped; an allowance alone does not execute a payment.
+3. `settle(round)` is callable by **any address** after the payment deadline. It is not `onlyOwner` and must not require the automation address. For each unpaid member it moves 100 USDC from locked collateral into the round pot, marks the member defaulted, and marks an as-yet-unreceived entitlement forfeited. It then records the round settled before transferring funds.
+4. If the scheduled recipient is eligible, settlement transfers exactly 1,200 USDC to them. Prefer direct transfer with a fallback `claimPayout()` credit if a transfer can fail, so one bad recipient cannot block all later rounds. If that recipient had forfeited, credit the 1,200 USDC to the explicit forfeited-pot bucket rather than guessing a replacement.
+5. `settleOverdue(maxRounds)` allows catch-up of several elapsed rounds in bounded chunks. Each round uses its original absolute deadline. This prevents six weeks of inactivity from permanently wedging the state machine and avoids an unbounded loop.
+6. `claimCollateral()`/`claimSurplus()` use pull payments after completion. A compliant member recovers unlocked collateral; slashed amounts are not withdrawable. Claims remain available indefinitely and do not block circle completion.
+
+Collateral accounting should be expressed as an invariant, not as a loose pooled balance. Before every payout, assets reserved for future obligations must remain at least the sum of all members' unpaid future installments. No admin withdrawal, fee, or forfeited-pot payout may invade that reserve.
+
+## Timing and default semantics
+
+Use explicit Unix timestamps and document UTC dates in the UI. A round has a payment-open time and a deadline. Settlement becomes valid at `deadline` (choose consistently whether equality is late). Chain timestamps can vary slightly, so do not make the boundary minute-sensitive. A multi-day grace window is appropriate for a monthly product.
+
+Default should be objective: failure to have a confirmed `pay(round)` transaction by the onchain deadline. A failed wallet transaction, insufficient allowance, bridge delay, sequencer outage, or unavailable frontend is otherwise still a default. Provide an alternate static frontend and publish verified contract addresses/ABIs so members can transact without the builders' site.
+
+Decide whether one miss permanently forfeits a future payout, and what happens if the member already received. The recommendation is permanent default status in both cases: collateral continues securing every remaining installment; if they already received, there is no entitlement left to forfeit. Never attempt to claw back an earlier pot.
+
+## Will already-running circles work for the next six weeks?
+
+This is a property of the **deployed bytecode and current onchain state**, not of the intended design. With no contracts or deployment addresses in this repository, it cannot be asserted that existing circles are safe. Check each deployed circle against the following decision table before leaving:
+
+| Existing behavior/state | What happens while both builders are away | Required action before leaving |
+|---|---|---|
+| `settle`/`advance` is admin-only and builders hold the only key | Payments may accumulate, but the deadline does nothing and recipients are not paid; later rounds may also reject payments because `currentRound` never advances | Transfer the operational role to a well-secured multisig with available signers, or—if upgradeable—ship and audit a permissionless settlement upgrade. Otherwise migrate/refund before leaving |
+| Settlement is permissionless but nobody calls it | The circle stalls at the first deadline; it may catch up only if the code permits late/multi-round settlement | Fund and test automation **and** document that any member/recipient can call. Add bounded catch-up if upgradeable; otherwise arrange a caller for each deadline |
+| A keeper is the only practical caller | It stops on depleted gas/subscription balance, expired credentials, RPC failure, rate limits, or a reverted transaction | Pre-fund beyond six weeks, configure alerts and a second independent caller, and run a real end-to-end test. Do not make keeper identity privileged |
+| Payments depend on a builder-run backend or relayer | Members cannot pay; after the grace period they are marked in default | Enable direct member transactions and publish a fallback UI/instructions; fund redundant relaying only as convenience |
+| Contract relies on ERC-20 allowance to “auto-debit” | Nothing is debited automatically; allowance authorizes a later transaction but does not create one | Ensure a public/automated `collect` call exists and is funded, or require members to call `pay` |
+| No collateral/guarantee is currently locked | The first missed payment makes the available pot less than 1,200 USDC (or causes exact-payout settlement to revert). Earlier paid-out contributions cannot cover it | Top up a contract-supported reserve before activation/next round. If bytecode cannot account for it safely, migrate or disclose that payouts are not guaranteed; merely sending USDC to the contract may strand it |
+| Contract processes all overdue rounds in one unbounded loop | Catch-up can exceed block gas and become impossible as backlog grows | Add bounded `settleOverdue(maxRounds)` if upgradeable; otherwise schedule settlement every round and test worst-case gas now |
+| Pauser/admin can freeze active circles and key is unavailable | An accidental/existing pause cannot be cleared; compromised admin can stop progress | Verify unpaused state, use a multisig with available signers, and narrowly scope pause powers. Claims/refunds should ideally remain callable while paused |
+| Upgradeable proxy depends on one builder key | A key loss/compromise is a major risk, though absence alone does not stop immutable logic | Move ownership to a tested multisig/timelock; do not perform an unreviewed upgrade immediately before departure |
+| Circle is already fully funded, deadlines are absolute, member payment and bounded settlement are permissionless, collateral is sufficient, and claims are pull-based | It continues without either builder. Calls still need members or automation, but no special builder action is required | Publish runbook and addresses, test one settlement path, monitor alerts, then leave it alone |
+
+Six weeks likely crosses at least one monthly deadline and can cross two depending on departure date. Test the exact timestamps for every active circle rather than assuming “one month.” Also verify chain-native gas balances for the automation/caller, USDC balances and allowances for members, reserve sufficiency, current round, pause state, and emitted events.
+
+## Pre-departure acceptance test
+
+Run this against a fork at each active deployment's current state:
+
+1. Record proxy implementation, admin/owner/pauser roles, current round, next two deadlines, balances, and liabilities.
+2. Advance time past one deadline with one unpaid member. Confirm anyone can settle, exactly 1,200 USDC is paid, exactly 100 USDC collateral is slashed, and the missed member's correct entitlement is forfeited.
+3. Advance through a second deadline with no builder/admin transactions. Confirm bounded catch-up and that round order/deadlines do not drift.
+4. Simulate keeper failure and use an ordinary fresh address to settle.
+5. Simulate a recipient transfer/claim failure and confirm later rounds remain live.
+6. Assert after every action: no double payment, no double settlement, each eligible recipient gets at most one pot, total token assets equal accounted liabilities, and future-obligation collateral remains untouched.
+7. Test completion and collateral/surplus claims, including a member who paid, one who defaulted before their turn, and one who defaulted after receiving.
+
+If any deployed circle fails these tests and cannot be safely upgraded, the honest options before departure are to appoint an available operator where that is sufficient, or stop accepting new money and execute the contract's documented refund/migration path. Do not promise autonomous operation based only on a keeper dashboard or on funds visible at the contract address.
+
+## Operational runbook
+
+Emit indexed events for payment, default, forfeiture, settlement, payout credit/claim, collateral slash/refund, pause, and configuration at activation. Monitor: deadline approaching with unpaid members, deadline passed but unsettled, automation gas low, reserve below liabilities, paused state, and unexpected admin/implementation changes. Alerts must go to someone who is actually available during the six weeks.
+
+Publish, before leaving, the chain ID, verified addresses, exact deadlines, member payment instructions, public settlement instructions, fallback RPC/frontend, automation status, and escalation contact. No runbook can compensate for admin-only bytecode when the only admins are away; that case needs an onchain role change, upgrade, or migration before departure.

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-003/2026-08-28T144237Z-codex-no-skill-1/workspace/plan.md
diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..21c57e9d5479ab41659cc2f5a78aa22ddf3c2eec
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,99 @@
+# Onchain susu: contract design and unattended-operation plan
+
+## Bottom line
+
+A Solidity contract does not wake up when a month ends. A running circle can survive the builders being away only if (1) members can pay without an admin, (2) advancing/settling a round is permissionless and is actually called by a member, recipient, or funded automation service, and (3) enough assets are already locked to cover defaults. An admin-only `closeRound`, an unfunded/offline keeper, a paused contract, or a design that treats already-paid-out contributions as collateral will stop or underfund the circle.
+
+Six weeks is therefore safe for the design below: members submit their own payments, anyone can settle after the deadline, and a recipient has a direct financial reason to do so. Automation is useful redundancy, not a trusted dependency. If existing deployed circles do not already have those properties, they cannot be repaired merely by leaving a bot running; see the pre-departure checklist and migration cases below.
+
+## First resolve the economic contradiction
+
+Twelve monthly payments of 100 USDC exactly fund a 1,200 USDC payout. After each payout, the contract has no surplus. A member's “earlier contributions” have already helped fund earlier recipients and are not still available to cover that member's future missed payment.
+
+Consequently, guaranteed 1,200 USDC payouts require one of:
+
+- default collateral locked in addition to monthly contributions;
+- an external guarantor/credit line;
+- smaller or delayed payouts when somebody defaults.
+
+The recommended version uses collateral. Each member locks 1,200 USDC at admission (or, less conservatively, the maximum value of their obligations that remain after they receive the pot). Each successful 100 USDC monthly payment unlocks 100 USDC of that member's collateral after settlement. On a missed payment, settlement takes 100 USDC from their collateral instead. This preserves a full pot even if a member receives first and then stops paying. Requiring only “contributions made so far” does not solve that worst case.
+
+The product statement also needs one policy clarified: “everyone gets exactly one turn” conflicts with “a defaulter forfeits their turn.” The implementable interpretation used here is: every member starts with one scheduled entitlement; a member who defaults before receiving loses it, so every *non-defaulting* member receives exactly once. A forfeited pot must not silently be awarded twice. Recommended handling is to keep the twelve fixed round slots and, in a forfeited recipient's slot, distribute that round's net assets pro rata to members who have not defaulted after the circle ends (or send them to an explicitly named community beneficiary). If the intended rule is instead to promote the next eligible recipient, that changes timing/order and must be specified and tested separately.
+
+## Contract shape
+
+Deploy one small immutable `Circle` per group from a factory (or minimal proxies if deployment cost matters). Avoid an upgrade/admin dependency for active circles. Constructor/initializer parameters are immutable after activation:
+
+- the exact USDC token address and its decimals-aware amount (`100_000_000` for six-decimal USDC);
+- exactly twelve unique, nonzero member addresses in payout order;
+- `startTime`, round length, and payment/grace-window length;
+- collateral requirement and the forfeited-pot beneficiary policy;
+- an optional automation address with no exclusive privilege.
+
+Activation is allowed only after all twelve members have deposited the required collateral. Do not accept arbitrary ERC-20s. Use safe transfer wrappers, checks-effects-interactions, a reentrancy guard, and balance-delta checks so accounting cannot claim more USDC than was actually received. Keep accounting in integer USDC base units.
+
+Core state per circle:
+
+- lifecycle: `Funding`, `Active`, `Complete`, or emergency-paused;
+- current round, fixed recipient array, and absolute deadlines derived from the fixed start time rather than from the last caller's timestamp;
+- per member: collateral remaining, rounds paid bitmap, defaulted/forfeited flag, and payout-received flag;
+- aggregate contribution balance, collateral balance, forfeited-pot balance, and claimable refunds;
+- settled bitmap so settlement is idempotent and no round can pay twice.
+
+Core functions:
+
+1. `depositCollateral()` transfers collateral before activation. A member may withdraw only if activation fails by a stated funding deadline.
+2. `pay(round)` is called by a member during that round's payment window. It transfers exactly 100 USDC and marks that member paid. It rejects duplicate, early, late, or wrong-round payments. Supporting EIP-2612/Permit2 can improve UX, but must be optional and carefully scoped; an allowance alone does not execute a payment.
+3. `settle(round)` is callable by **any address** after the payment deadline. It is not `onlyOwner` and must not require the automation address. For each unpaid member it moves 100 USDC from locked collateral into the round pot, marks the member defaulted, and marks an as-yet-unreceived entitlement forfeited. It then records the round settled before crediting the payout.
+4. If the scheduled recipient is eligible, settlement credits exactly 1,200 USDC to their `claimPayout()` balance. Keeping the external USDC transfer out of settlement means a bad recipient address cannot block later rounds. If that recipient had forfeited, credit the 1,200 USDC to the explicit forfeited-pot bucket rather than guessing a replacement.
+5. `settleOverdue(maxRounds)` allows catch-up of several elapsed rounds in bounded chunks. Each round uses its original absolute deadline. This prevents six weeks of inactivity from permanently wedging the state machine and avoids an unbounded loop.
+6. `claimCollateral()`/`claimSurplus()` use pull payments after completion. A compliant member recovers unlocked collateral; slashed amounts are not withdrawable. Claims remain available indefinitely and do not block circle completion.
+
+Collateral accounting should be expressed as an invariant, not as a loose pooled balance. Before every payout, assets reserved for future obligations must remain at least the sum of all members' unpaid future installments. No admin withdrawal, fee, or forfeited-pot payout may invade that reserve.
+
+## Timing and default semantics
+
+Use explicit Unix timestamps and document UTC dates in the UI. A round has a payment-open time and a deadline. Settlement becomes valid at `deadline` (choose consistently whether equality is late). Chain timestamps can vary slightly, so do not make the boundary minute-sensitive. A multi-day grace window is appropriate for a monthly product.
+
+Default should be objective: failure to have a confirmed `pay(round)` transaction by the onchain deadline. A failed wallet transaction, insufficient allowance, bridge delay, sequencer outage, or unavailable frontend is otherwise still a default. Provide an alternate static frontend and publish verified contract addresses/ABIs so members can transact without the builders' site.
+
+Decide whether one miss permanently forfeits a future payout, and what happens if the member already received. The recommendation is permanent default status in both cases: collateral continues securing every remaining installment; if they already received, there is no entitlement left to forfeit. Never attempt to claw back an earlier pot.
+
+## Will already-running circles work for the next six weeks?
+
+This is a property of the **deployed bytecode and current onchain state**, not of the intended design. With no contracts or deployment addresses in this repository, it cannot be asserted that existing circles are safe. Check each deployed circle against the following decision table before leaving:
+
+| Existing behavior/state | What happens while both builders are away | Required action before leaving |
+|---|---|---|
+| `settle`/`advance` is admin-only and builders hold the only key | Payments may accumulate, but the deadline does nothing and recipients are not paid; later rounds may also reject payments because `currentRound` never advances | Transfer the operational role to a well-secured multisig with available signers, or—if upgradeable—ship and audit a permissionless settlement upgrade. Otherwise migrate/refund before leaving |
+| Settlement is permissionless but nobody calls it | The circle stalls at the first deadline; it may catch up only if the code permits late/multi-round settlement | Fund and test automation **and** document that any member/recipient can call. Add bounded catch-up if upgradeable; otherwise arrange a caller for each deadline |
+| A keeper is the only practical caller | It stops on depleted gas/subscription balance, expired credentials, RPC failure, rate limits, or a reverted transaction | Pre-fund beyond six weeks, configure alerts and a second independent caller, and run a real end-to-end test. Do not make keeper identity privileged |
+| Payments depend on a builder-run backend or relayer | Members cannot pay; after the grace period they are marked in default | Enable direct member transactions and publish a fallback UI/instructions; fund redundant relaying only as convenience |
+| Contract relies on ERC-20 allowance to “auto-debit” | Nothing is debited automatically; allowance authorizes a later transaction but does not create one | Ensure a public/automated `collect` call exists and is funded, or require members to call `pay` |
+| No collateral/guarantee is currently locked | The first missed payment makes the available pot less than 1,200 USDC (or causes exact-payout settlement to revert). Earlier paid-out contributions cannot cover it | Top up a contract-supported reserve before activation/next round. If bytecode cannot account for it safely, migrate or disclose that payouts are not guaranteed; merely sending USDC to the contract may strand it |
+| Contract processes all overdue rounds in one unbounded loop | Catch-up can exceed block gas and become impossible as backlog grows | Add bounded `settleOverdue(maxRounds)` if upgradeable; otherwise schedule settlement every round and test worst-case gas now |
+| Pauser/admin can freeze active circles and key is unavailable | An accidental/existing pause cannot be cleared; compromised admin can stop progress | Verify unpaused state, use a multisig with available signers, and narrowly scope pause powers. Claims/refunds should ideally remain callable while paused |
+| Upgradeable proxy depends on one builder key | A key loss/compromise is a major risk, though absence alone does not stop immutable logic | Move ownership to a tested multisig/timelock; do not perform an unreviewed upgrade immediately before departure |
+| Circle is already fully funded, deadlines are absolute, member payment and bounded settlement are permissionless, collateral is sufficient, and claims are pull-based | It continues without either builder. Calls still need members or automation, but no special builder action is required | Publish runbook and addresses, test one settlement path, monitor alerts, then leave it alone |
+
+Six weeks likely crosses at least one monthly deadline and can cross two depending on departure date. Test the exact timestamps for every active circle rather than assuming “one month.” Also verify chain-native gas balances for the automation/caller, USDC balances and allowances for members, reserve sufficiency, current round, pause state, and emitted events.
+
+## Pre-departure acceptance test
+
+Run this against a fork at each active deployment's current state:
+
+1. Record proxy implementation, admin/owner/pauser roles, current round, next two deadlines, balances, and liabilities.
+2. Advance time past one deadline with one unpaid member. Confirm anyone can settle, exactly 1,200 USDC is paid, exactly 100 USDC collateral is slashed, and the missed member's correct entitlement is forfeited.
+3. Advance through a second deadline with no builder/admin transactions. Confirm bounded catch-up and that round order/deadlines do not drift.
+4. Simulate keeper failure and use an ordinary fresh address to settle.
+5. Simulate a recipient transfer/claim failure and confirm later rounds remain live.
+6. Assert after every action: no double payment, no double settlement, each eligible recipient gets at most one pot, total token assets equal accounted liabilities, and future-obligation collateral remains untouched.
+7. Test completion and collateral/surplus claims, including a member who paid, one who defaulted before their turn, and one who defaulted after receiving.
+
+If any deployed circle fails these tests and cannot be safely upgraded, the honest options before departure are to appoint an available operator where that is sufficient, or stop accepting new money and execute the contract's documented refund/migration path. Do not promise autonomous operation based only on a keeper dashboard or on funds visible at the contract address.
+
+## Operational runbook
+
+Emit indexed events for payment, default, forfeiture, settlement, payout credit/claim, collateral slash/refund, pause, and configuration at activation. Monitor: deadline approaching with unpaid members, deadline passed but unsettled, automation gas low, reserve below liabilities, paused state, and unexpected admin/implementation changes. Alerts must go to someone who is actually available during the six weeks.
+
+Publish, before leaving, the chain ID, verified addresses, exact deadlines, member payment instructions, public settlement instructions, fallback RPC/frontend, automation status, and escalation contact. No runbook can compensate for admin-only bytecode when the only admins are away; that case needs an onchain role change, upgrade, or migration before departure.

diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..21c57e9d5479ab41659cc2f5a78aa22ddf3c2eec
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,99 @@
+# Onchain susu: contract design and unattended-operation plan
+
+## Bottom line
+
+A Solidity contract does not wake up when a month ends. A running circle can survive the builders being away only if (1) members can pay without an admin, (2) advancing/settling a round is permissionless and is actually called by a member, recipient, or funded automation service, and (3) enough assets are already locked to cover defaults. An admin-only `closeRound`, an unfunded/offline keeper, a paused contract, or a design that treats already-paid-out contributions as collateral will stop or underfund the circle.
+
+Six weeks is therefore safe for the design below: members submit their own payments, anyone can settle after the deadline, and a recipient has a direct financial reason to do so. Automation is useful redundancy, not a trusted dependency. If existing deployed circles do not already have those properties, they cannot be repaired merely by leaving a bot running; see the pre-departure checklist and migration cases below.
+
+## First resolve the economic contradiction
+
+Twelve monthly payments of 100 USDC exactly fund a 1,200 USDC payout. After each payout, the contract has no surplus. A member's “earlier contributions” have already helped fund earlier recipients and are not still available to cover that member's future missed payment.
+
+Consequently, guaranteed 1,200 USDC payouts require one of:
+
+- default collateral locked in addition to monthly contributions;
+- an external guarantor/credit line;
+- smaller or delayed payouts when somebody defaults.
+
+The recommended version uses collateral. Each member locks 1,200 USDC at admission (or, less conservatively, the maximum value of their obligations that remain after they receive the pot). Each successful 100 USDC monthly payment unlocks 100 USDC of that member's collateral after settlement. On a missed payment, settlement takes 100 USDC from their collateral instead. This preserves a full pot even if a member receives first and then stops paying. Requiring only “contributions made so far” does not solve that worst case.
+
+The product statement also needs one policy clarified: “everyone gets exactly one turn” conflicts with “a defaulter forfeits their turn.” The implementable interpretation used here is: every member starts with one scheduled entitlement; a member who defaults before receiving loses it, so every *non-defaulting* member receives exactly once. A forfeited pot must not silently be awarded twice. Recommended handling is to keep the twelve fixed round slots and, in a forfeited recipient's slot, distribute that round's net assets pro rata to members who have not defaulted after the circle ends (or send them to an explicitly named community beneficiary). If the intended rule is instead to promote the next eligible recipient, that changes timing/order and must be specified and tested separately.
+
+## Contract shape
+
+Deploy one small immutable `Circle` per group from a factory (or minimal proxies if deployment cost matters). Avoid an upgrade/admin dependency for active circles. Constructor/initializer parameters are immutable after activation:
+
+- the exact USDC token address and its decimals-aware amount (`100_000_000` for six-decimal USDC);
+- exactly twelve unique, nonzero member addresses in payout order;
+- `startTime`, round length, and payment/grace-window length;
+- collateral requirement and the forfeited-pot beneficiary policy;
+- an optional automation address with no exclusive privilege.
+
+Activation is allowed only after all twelve members have deposited the required collateral. Do not accept arbitrary ERC-20s. Use safe transfer wrappers, checks-effects-interactions, a reentrancy guard, and balance-delta checks so accounting cannot claim more USDC than was actually received. Keep accounting in integer USDC base units.
+
+Core state per circle:
+
+- lifecycle: `Funding`, `Active`, `Complete`, or emergency-paused;
+- current round, fixed recipient array, and absolute deadlines derived from the fixed start time rather than from the last caller's timestamp;
+- per member: collateral remaining, rounds paid bitmap, defaulted/forfeited flag, and payout-received flag;
+- aggregate contribution balance, collateral balance, forfeited-pot balance, and claimable refunds;
+- settled bitmap so settlement is idempotent and no round can pay twice.
+
+Core functions:
+
+1. `depositCollateral()` transfers collateral before activation. A member may withdraw only if activation fails by a stated funding deadline.
+2. `pay(round)` is called by a member during that round's payment window. It transfers exactly 100 USDC and marks that member paid. It rejects duplicate, early, late, or wrong-round payments. Supporting EIP-2612/Permit2 can improve UX, but must be optional and carefully scoped; an allowance alone does not execute a payment.
+3. `settle(round)` is callable by **any address** after the payment deadline. It is not `onlyOwner` and must not require the automation address. For each unpaid member it moves 100 USDC from locked collateral into the round pot, marks the member defaulted, and marks an as-yet-unreceived entitlement forfeited. It then records the round settled before crediting the payout.
+4. If the scheduled recipient is eligible, settlement credits exactly 1,200 USDC to their `claimPayout()` balance. Keeping the external USDC transfer out of settlement means a bad recipient address cannot block later rounds. If that recipient had forfeited, credit the 1,200 USDC to the explicit forfeited-pot bucket rather than guessing a replacement.
+5. `settleOverdue(maxRounds)` allows catch-up of several elapsed rounds in bounded chunks. Each round uses its original absolute deadline. This prevents six weeks of inactivity from permanently wedging the state machine and avoids an unbounded loop.
+6. `claimCollateral()`/`claimSurplus()` use pull payments after completion. A compliant member recovers unlocked collateral; slashed amounts are not withdrawable. Claims remain available indefinitely and do not block circle completion.
+
+Collateral accounting should be expressed as an invariant, not as a loose pooled balance. Before every payout, assets reserved for future obligations must remain at least the sum of all members' unpaid future installments. No admin withdrawal, fee, or forfeited-pot payout may invade that reserve.
+
+## Timing and default semantics
+
+Use explicit Unix timestamps and document UTC dates in the UI. A round has a payment-open time and a deadline. Settlement becomes valid at `deadline` (choose consistently whether equality is late). Chain timestamps can vary slightly, so do not make the boundary minute-sensitive. A multi-day grace window is appropriate for a monthly product.
+
+Default should be objective: failure to have a confirmed `pay(round)` transaction by the onchain deadline. A failed wallet transaction, insufficient allowance, bridge delay, sequencer outage, or unavailable frontend is otherwise still a default. Provide an alternate static frontend and publish verified contract addresses/ABIs so members can transact without the builders' site.
+
+Decide whether one miss permanently forfeits a future payout, and what happens if the member already received. The recommendation is permanent default status in both cases: collateral continues securing every remaining installment; if they already received, there is no entitlement left to forfeit. Never attempt to claw back an earlier pot.
+
+## Will already-running circles work for the next six weeks?
+
+This is a property of the **deployed bytecode and current onchain state**, not of the intended design. With no contracts or deployment addresses in this repository, it cannot be asserted that existing circles are safe. Check each deployed circle against the following decision table before leaving:
+
+| Existing behavior/state | What happens while both builders are away | Required action before leaving |
+|---|---|---|
+| `settle`/`advance` is admin-only and builders hold the only key | Payments may accumulate, but the deadline does nothing and recipients are not paid; later rounds may also reject payments because `currentRound` never advances | Transfer the operational role to a well-secured multisig with available signers, or—if upgradeable—ship and audit a permissionless settlement upgrade. Otherwise migrate/refund before leaving |
+| Settlement is permissionless but nobody calls it | The circle stalls at the first deadline; it may catch up only if the code permits late/multi-round settlement | Fund and test automation **and** document that any member/recipient can call. Add bounded catch-up if upgradeable; otherwise arrange a caller for each deadline |
+| A keeper is the only practical caller | It stops on depleted gas/subscription balance, expired credentials, RPC failure, rate limits, or a reverted transaction | Pre-fund beyond six weeks, configure alerts and a second independent caller, and run a real end-to-end test. Do not make keeper identity privileged |
+| Payments depend on a builder-run backend or relayer | Members cannot pay; after the grace period they are marked in default | Enable direct member transactions and publish a fallback UI/instructions; fund redundant relaying only as convenience |
+| Contract relies on ERC-20 allowance to “auto-debit” | Nothing is debited automatically; allowance authorizes a later transaction but does not create one | Ensure a public/automated `collect` call exists and is funded, or require members to call `pay` |
+| No collateral/guarantee is currently locked | The first missed payment makes the available pot less than 1,200 USDC (or causes exact-payout settlement to revert). Earlier paid-out contributions cannot cover it | Top up a contract-supported reserve before activation/next round. If bytecode cannot account for it safely, migrate or disclose that payouts are not guaranteed; merely sending USDC to the contract may strand it |
+| Contract processes all overdue rounds in one unbounded loop | Catch-up can exceed block gas and become impossible as backlog grows | Add bounded `settleOverdue(maxRounds)` if upgradeable; otherwise schedule settlement every round and test worst-case gas now |
+| Pauser/admin can freeze active circles and key is unavailable | An accidental/existing pause cannot be cleared; compromised admin can stop progress | Verify unpaused state, use a multisig with available signers, and narrowly scope pause powers. Claims/refunds should ideally remain callable while paused |
+| Upgradeable proxy depends on one builder key | A key loss/compromise is a major risk, though absence alone does not stop immutable logic | Move ownership to a tested multisig/timelock; do not perform an unreviewed upgrade immediately before departure |
+| Circle is already fully funded, deadlines are absolute, member payment and bounded settlement are permissionless, collateral is sufficient, and claims are pull-based | It continues without either builder. Calls still need members or automation, but no special builder action is required | Publish runbook and addresses, test one settlement path, monitor alerts, then leave it alone |
+
+Six weeks likely crosses at least one monthly deadline and can cross two depending on departure date. Test the exact timestamps for every active circle rather than assuming “one month.” Also verify chain-native gas balances for the automation/caller, USDC balances and allowances for members, reserve sufficiency, current round, pause state, and emitted events.
+
+## Pre-departure acceptance test
+
+Run this against a fork at each active deployment's current state:
+
+1. Record proxy implementation, admin/owner/pauser roles, current round, next two deadlines, balances, and liabilities.
+2. Advance time past one deadline with one unpaid member. Confirm anyone can settle, exactly 1,200 USDC is paid, exactly 100 USDC collateral is slashed, and the missed member's correct entitlement is forfeited.
+3. Advance through a second deadline with no builder/admin transactions. Confirm bounded catch-up and that round order/deadlines do not drift.
+4. Simulate keeper failure and use an ordinary fresh address to settle.
+5. Simulate a recipient transfer/claim failure and confirm later rounds remain live.
+6. Assert after every action: no double payment, no double settlement, each eligible recipient gets at most one pot, total token assets equal accounted liabilities, and future-obligation collateral remains untouched.
+7. Test completion and collateral/surplus claims, including a member who paid, one who defaulted before their turn, and one who defaulted after receiving.
+
+If any deployed circle fails these tests and cannot be safely upgraded, the honest options before departure are to appoint an available operator where that is sufficient, or stop accepting new money and execute the contract's documented refund/migration path. Do not promise autonomous operation based only on a keeper dashboard or on funds visible at the contract address.
+
+## Operational runbook
+
+Emit indexed events for payment, default, forfeiture, settlement, payout credit/claim, collateral slash/refund, pause, and configuration at activation. Monitor: deadline approaching with unpaid members, deadline passed but unsettled, automation gas low, reserve below liabilities, paused state, and unexpected admin/implementation changes. Alerts must go to someone who is actually available during the six weeks.
+
+Publish, before leaving, the chain ID, verified addresses, exact deadlines, member payment instructions, public settlement instructions, fallback RPC/frontend, automation status, and escalation contact. No runbook can compensate for admin-only bytecode when the only admins are away; that case needs an onchain role change, upgrade, or migration before departure.

codex
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-003/2026-08-28T144237Z-codex-no-skill-1/workspace/plan.md).

It covers:

- The collateralized contract design and solvency invariants.
- Permissionless payments, settlement, catch-up, and claims.
- Default and forfeited-turn semantics.
- Why prior contributions cannot cover defaults after being paid out.
- Exactly when existing circles will stall during the six-week absence.
- Required upgrades, operator arrangements, migration options, tests, and monitoring.

No deployed contracts or addresses were present, so the document clearly distinguishes the recommended design from what must be verified on existing deployments.
diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..21c57e9d5479ab41659cc2f5a78aa22ddf3c2eec
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,99 @@
+# Onchain susu: contract design and unattended-operation plan
+
+## Bottom line
+
+A Solidity contract does not wake up when a month ends. A running circle can survive the builders being away only if (1) members can pay without an admin, (2) advancing/settling a round is permissionless and is actually called by a member, recipient, or funded automation service, and (3) enough assets are already locked to cover defaults. An admin-only `closeRound`, an unfunded/offline keeper, a paused contract, or a design that treats already-paid-out contributions as collateral will stop or underfund the circle.
+
+Six weeks is therefore safe for the design below: members submit their own payments, anyone can settle after the deadline, and a recipient has a direct financial reason to do so. Automation is useful redundancy, not a trusted dependency. If existing deployed circles do not already have those properties, they cannot be repaired merely by leaving a bot running; see the pre-departure checklist and migration cases below.
+
+## First resolve the economic contradiction
+
+Twelve monthly payments of 100 USDC exactly fund a 1,200 USDC payout. After each payout, the contract has no surplus. A member's “earlier contributions” have already helped fund earlier recipients and are not still available to cover that member's future missed payment.
+
+Consequently, guaranteed 1,200 USDC payouts require one of:
+
+- default collateral locked in addition to monthly contributions;
+- an external guarantor/credit line;
+- smaller or delayed payouts when somebody defaults.
+
+The recommended version uses collateral. Each member locks 1,200 USDC at admission (or, less conservatively, the maximum value of their obligations that remain after they receive the pot). Each successful 100 USDC monthly payment unlocks 100 USDC of that member's collateral after settlement. On a missed payment, settlement takes 100 USDC from their collateral instead. This preserves a full pot even if a member receives first and then stops paying. Requiring only “contributions made so far” does not solve that worst case.
+
+The product statement also needs one policy clarified: “everyone gets exactly one turn” conflicts with “a defaulter forfeits their turn.” The implementable interpretation used here is: every member starts with one scheduled entitlement; a member who defaults before receiving loses it, so every *non-defaulting* member receives exactly once. A forfeited pot must not silently be awarded twice. Recommended handling is to keep the twelve fixed round slots and, in a forfeited recipient's slot, distribute that round's net assets pro rata to members who have not defaulted after the circle ends (or send them to an explicitly named community beneficiary). If the intended rule is instead to promote the next eligible recipient, that changes timing/order and must be specified and tested separately.
+
+## Contract shape
+
+Deploy one small immutable `Circle` per group from a factory (or minimal proxies if deployment cost matters). Avoid an upgrade/admin dependency for active circles. Constructor/initializer parameters are immutable after activation:
+
+- the exact USDC token address and its decimals-aware amount (`100_000_000` for six-decimal USDC);
+- exactly twelve unique, nonzero member addresses in payout order;
+- `startTime`, round length, and payment/grace-window length;
+- collateral requirement and the forfeited-pot beneficiary policy;
+- an optional automation address with no exclusive privilege.
+
+Activation is allowed only after all twelve members have deposited the required collateral. Do not accept arbitrary ERC-20s. Use safe transfer wrappers, checks-effects-interactions, a reentrancy guard, and balance-delta checks so accounting cannot claim more USDC than was actually received. Keep accounting in integer USDC base units.
+
+Core state per circle:
+
+- lifecycle: `Funding`, `Active`, `Complete`, or emergency-paused;
+- current round, fixed recipient array, and absolute deadlines derived from the fixed start time rather than from the last caller's timestamp;
+- per member: collateral remaining, rounds paid bitmap, defaulted/forfeited flag, and payout-received flag;
+- aggregate contribution balance, collateral balance, forfeited-pot balance, and claimable refunds;
+- settled bitmap so settlement is idempotent and no round can pay twice.
+
+Core functions:
+
+1. `depositCollateral()` transfers collateral before activation. A member may withdraw only if activation fails by a stated funding deadline.
+2. `pay(round)` is called by a member during that round's payment window. It transfers exactly 100 USDC and marks that member paid. It rejects duplicate, early, late, or wrong-round payments. Supporting EIP-2612/Permit2 can improve UX, but must be optional and carefully scoped; an allowance alone does not execute a payment.
+3. `settle(round)` is callable by **any address** after the payment deadline. It is not `onlyOwner` and must not require the automation address. For each unpaid member it moves 100 USDC from locked collateral into the round pot, marks the member defaulted, and marks an as-yet-unreceived entitlement forfeited. It then records the round settled before crediting the payout.
+4. If the scheduled recipient is eligible, settlement credits exactly 1,200 USDC to their `claimPayout()` balance. Keeping the external USDC transfer out of settlement means a bad recipient address cannot block later rounds. If that recipient had forfeited, credit the 1,200 USDC to the explicit forfeited-pot bucket rather than guessing a replacement.
+5. `settleOverdue(maxRounds)` allows catch-up of several elapsed rounds in bounded chunks. Each round uses its original absolute deadline. This prevents six weeks of inactivity from permanently wedging the state machine and avoids an unbounded loop.
+6. `claimCollateral()`/`claimSurplus()` use pull payments after completion. A compliant member recovers unlocked collateral; slashed amounts are not withdrawable. Claims remain available indefinitely and do not block circle completion.
+
+Collateral accounting should be expressed as an invariant, not as a loose pooled balance. Before every payout, assets reserved for future obligations must remain at least the sum of all members' unpaid future installments. No admin withdrawal, fee, or forfeited-pot payout may invade that reserve.
+
+## Timing and default semantics
+
+Use explicit Unix timestamps and document UTC dates in the UI. A round has a payment-open time and a deadline. Settlement becomes valid at `deadline` (choose consistently whether equality is late). Chain timestamps can vary slightly, so do not make the boundary minute-sensitive. A multi-day grace window is appropriate for a monthly product.
+
+Default should be objective: failure to have a confirmed `pay(round)` transaction by the onchain deadline. A failed wallet transaction, insufficient allowance, bridge delay, sequencer outage, or unavailable frontend is otherwise still a default. Provide an alternate static frontend and publish verified contract addresses/ABIs so members can transact without the builders' site.
+
+Decide whether one miss permanently forfeits a future payout, and what happens if the member already received. The recommendation is permanent default status in both cases: collateral continues securing every remaining installment; if they already received, there is no entitlement left to forfeit. Never attempt to claw back an earlier pot.
+
+## Will already-running circles work for the next six weeks?
+
+This is a property of the **deployed bytecode and current onchain state**, not of the intended design. With no contracts or deployment addresses in this repository, it cannot be asserted that existing circles are safe. Check each deployed circle against the following decision table before leaving:
+
+| Existing behavior/state | What happens while both builders are away | Required action before leaving |
+|---|---|---|
+| `settle`/`advance` is admin-only and builders hold the only key | Payments may accumulate, but the deadline does nothing and recipients are not paid; later rounds may also reject payments because `currentRound` never advances | Transfer the operational role to a well-secured multisig with available signers, or—if upgradeable—ship and audit a permissionless settlement upgrade. Otherwise migrate/refund before leaving |
+| Settlement is permissionless but nobody calls it | The circle stalls at the first deadline; it may catch up only if the code permits late/multi-round settlement | Fund and test automation **and** document that any member/recipient can call. Add bounded catch-up if upgradeable; otherwise arrange a caller for each deadline |
+| A keeper is the only practical caller | It stops on depleted gas/subscription balance, expired credentials, RPC failure, rate limits, or a reverted transaction | Pre-fund beyond six weeks, configure alerts and a second independent caller, and run a real end-to-end test. Do not make keeper identity privileged |
+| Payments depend on a builder-run backend or relayer | Members cannot pay; after the grace period they are marked in default | Enable direct member transactions and publish a fallback UI/instructions; fund redundant relaying only as convenience |
+| Contract relies on ERC-20 allowance to “auto-debit” | Nothing is debited automatically; allowance authorizes a later transaction but does not create one | Ensure a public/automated `collect` call exists and is funded, or require members to call `pay` |
+| No collateral/guarantee is currently locked | The first missed payment makes the available pot less than 1,200 USDC (or causes exact-payout settlement to revert). Earlier paid-out contributions cannot cover it | Top up a contract-supported reserve before activation/next round. If bytecode cannot account for it safely, migrate or disclose that payouts are not guaranteed; merely sending USDC to the contract may strand it |
+| Contract processes all overdue rounds in one unbounded loop | Catch-up can exceed block gas and become impossible as backlog grows | Add bounded `settleOverdue(maxRounds)` if upgradeable; otherwise schedule settlement every round and test worst-case gas now |
+| Pauser/admin can freeze active circles and key is unavailable | An accidental/existing pause cannot be cleared; compromised admin can stop progress | Verify unpaused state, use a multisig with available signers, and narrowly scope pause powers. Claims/refunds should ideally remain callable while paused |
+| Upgradeable proxy depends on one builder key | A key loss/compromise is a major risk, though absence alone does not stop immutable logic | Move ownership to a tested multisig/timelock; do not perform an unreviewed upgrade immediately before departure |
+| Circle is already fully funded, deadlines are absolute, member payment and bounded settlement are permissionless, collateral is sufficient, and claims are pull-based | It continues without either builder. Calls still need members or automation, but no special builder action is required | Publish runbook and addresses, test one settlement path, monitor alerts, then leave it alone |
+
+Six weeks likely crosses at least one monthly deadline and can cross two depending on departure date. Test the exact timestamps for every active circle rather than assuming “one month.” Also verify chain-native gas balances for the automation/caller, USDC balances and allowances for members, reserve sufficiency, current round, pause state, and emitted events.
+
+## Pre-departure acceptance test
+
+Run this against a fork at each active deployment's current state:
+
+1. Record proxy implementation, admin/owner/pauser roles, current round, next two deadlines, balances, and liabilities.
+2. Advance time past one deadline with one unpaid member. Confirm anyone can settle, exactly 1,200 USDC is paid, exactly 100 USDC collateral is slashed, and the missed member's correct entitlement is forfeited.
+3. Advance through a second deadline with no builder/admin transactions. Confirm bounded catch-up and that round order/deadlines do not drift.
+4. Simulate keeper failure and use an ordinary fresh address to settle.
+5. Simulate a recipient transfer/claim failure and confirm later rounds remain live.
+6. Assert after every action: no double payment, no double settlement, each eligible recipient gets at most one pot, total token assets equal accounted liabilities, and future-obligation collateral remains untouched.
+7. Test completion and collateral/surplus claims, including a member who paid, one who defaulted before their turn, and one who defaulted after receiving.
+
+If any deployed circle fails these tests and cannot be safely upgraded, the honest options before departure are to appoint an available operator where that is sufficient, or stop accepting new money and execute the contract's documented refund/migration path. Do not promise autonomous operation based only on a keeper dashboard or on funds visible at the contract address.
+
+## Operational runbook
+
+Emit indexed events for payment, default, forfeiture, settlement, payout credit/claim, collateral slash/refund, pause, and configuration at activation. Monitor: deadline approaching with unpaid members, deadline passed but unsettled, automation gas low, reserve below liabilities, paused state, and unexpected admin/implementation changes. Alerts must go to someone who is actually available during the six weeks.
+
+Publish, before leaving, the chain ID, verified addresses, exact deadlines, member payment instructions, public settlement instructions, fallback RPC/frontend, automation status, and escalation contact. No runbook can compensate for admin-only bytecode when the only admins are away; that case needs an onchain role change, upgrade, or migration before departure.

tokens used
31,215
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-003/2026-08-28T144237Z-codex-no-skill-1/workspace/plan.md).

It covers:

- The collateralized contract design and solvency invariants.
- Permissionless payments, settlement, catch-up, and claims.
- Default and forfeited-turn semantics.
- Why prior contributions cannot cover defaults after being paid out.
- Exactly when existing circles will stall during the six-week absence.
- Required upgrades, operator arrangements, migration options, tests, and monitoring.

No deployed contracts or addresses were present, so the document clearly distinguishes the recommended design from what must be verified on existing deployments.
