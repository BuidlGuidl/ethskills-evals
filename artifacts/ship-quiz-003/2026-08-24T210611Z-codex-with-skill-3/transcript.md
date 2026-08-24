Reading additional input from stdin...
OpenAI Codex v0.146.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-003/2026-08-24T210611Z-codex-with-skill-3/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a03598-59db-7e52-ad48-04e705ec9967
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
2026-08-24T21:06:12.259215Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a03598-59db-7e52-ad48-04e705ec9967.tmp-1787605572071005391: line 2547: syntax error near unexpected token `('

codex
I’m using the `ship` skill because this is an Ethereum dApp architecture and operational-liveness question. I’ll inspect its guidance, then write the design and absence analysis directly to `plan.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-003/2026-08-24T210611Z-codex-with-skill-3/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
---
name: ship
description: Plan and ship a minimal Ethereum dApp from architecture through deployment. Use before or during a build to decide the onchain boundary, contract surface, state-transition callers, target chain, and production handoff.
---

# Ship a dApp

Before coding, write down the smallest vertical slice that can ship. Decide what
is onchain, how many custom contracts it needs, who advances every state
transition, and one deployment target. Do not expand into a full application or
fetch every related skill before this plan is concrete.

## Architecture

Put only trustless ownership, value transfer, composability, censorship
resistance, or permanent commitments onchain. Keep profiles, descriptions,
media, search, filtering, and frequently changing rules in an offchain store;
put a content hash or URI onchain only when verification needs it.

Treat reputation and rankings as derived data. Emit the facts needed to compute
them, then calculate and sort offchain. Do not maintain a computed score,
leaderboard, or paginated ranking in contract storage merely to serve a browse
screen. Recording counters that settlement already needs is fine.

Prefer existing audited protocols and primitives. Most MVPs need zero to two
custom contracts; more than three is a signal to reduce scope. Do not add a
factory, escrow, router, or fee-splitter unless its separate trust boundary is
required by the product.

## State transitions

Contracts do not run on schedules. For each state-changing function, record:

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `claimPayout()` | recipient | receives the payout | funds remain claimable |
| permissionless settlement | keeper or participant | explicit fee or direct benefit | settlement waits |

Naming a permissionless caller is not an incentive. Identify the caller's
benefit and the source of any keeper fee. Prefer self-serve or permissionless
paths over an owner-only cron job; automation may be a convenience, but it must
not be the only liveness path.

Include the completed transition table in the project README, especially for
every function that moves funds.

## Chain and deployment decision

Choose one target chain for the first release and state why its capabilities fit
the product. Measure current fees when cost affects the decision; do not rely on
remembered gas prices. An L2 should be selected for a concrete product fit such
as its distribution, liquidity, account abstraction, or ecosystem—not merely
because “Ethereum is expensive.”

Before calling the MVP shippable, the README must name the target and contain
the exact deploy and verification commands, required environment variables,
contract ownership destination, and a small post-deploy transaction to verify
the path end to end. Do not leave the network or deployment procedure as TBD.

## Minimal ship checklist

- Onchain/offchain boundary is explicit, including where rankings are computed.
- Custom contract list is concrete and no larger than the MVP requires.
- Every state transition has a caller, incentive, and safe no-caller outcome.
- One target chain is selected for a product-specific reason.
- Tests cover custom logic and external integrations use a fork.
- README contains the transition table and executable deployment runbook.
- Contracts are verified and production ownership goes to the intended multisig.
- A fresh reviewer checks the finished vertical slice before launch.

Fetch another focused skill only when the plan reaches that phase and needs its
details—for example `security`, `testing`, `frontend-ux`, `frontend-playbook`,
or `qa`. Stop when the requested vertical slice and its runbook are complete.

codex
The key design constraint is now clear: a contract cannot wake itself up each month, and prior monthly contributions cannot cover a later default if those funds were already paid out. The plan will separate those two issues and specify a design that remains usable without either builder online.
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-003/2026-08-24T210611Z-codex-with-skill-3/workspace/plan.md
diff --git a/artifacts/ship-quiz-003/2026-08-24T210611Z-codex-with-skill-3/workspace/plan.md b/artifacts/ship-quiz-003/2026-08-24T210611Z-codex-with-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..35857eb79fa5a10c0aeef5dda7a5f81f3246eeab
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-08-24T210611Z-codex-with-skill-3/workspace/plan.md
@@ -0,0 +1,109 @@
+# Onchain susu: contract and six-week absence plan
+
+## Bottom line
+
+Running circles can continue while both builders are away **only if every required transition is callable by participants (or permissionlessly), and the contract already holds enough USDC to honor defaults**. A contract does not wake up when a month ends. A web server, cron job, or owner account may make settlement convenient, but it cannot be the sole liveness path.
+
+There is also an economic flaw in the proposed rule as stated: earlier monthly contributions cannot cover a later missed payment after those contributions have already been included in earlier $1,200 payouts. The same USDC cannot be paid out twice. “Forfeit their turn” limits the defaulter's benefit, but does not restore money already paid or guarantee later recipients. The circle must either pre-fund obligations, lock separate collateral, accept underfunded payouts, or rely on offchain collection.
+
+For a trust-minimized first version, I recommend full pre-funding: each of the 12 members escrows 1,200 USDC before activation. It is simple, guarantees every payout, and requires no credit or liquidation system. If monthly cash flow is essential, use the collateralized variant described below and be explicit that it requires materially more contract and product complexity.
+
+## Minimal architecture
+
+Deploy one custom `SusuCircle` contract for a single circle. Do not add a factory for the first release; deploy another instance when needed. Use the canonical USDC contract and OpenZeppelin `SafeERC20`, `ReentrancyGuard`, and immutable configuration.
+
+Onchain state should contain:
+
+- the 12 member addresses in their fixed payout order;
+- USDC token address, 100 USDC monthly unit, 1,200 USDC pot, start time, and month/epoch duration;
+- activation state, each member's funded balance, default/forfeiture status, and a bitmap or mapping of paid/claimed epochs;
+- an immutable grace period agreed before deposits;
+- emergency state whose powers are narrowly defined and cannot confiscate or reorder funds.
+
+Names, contact details, reminders, calendar displays, and transaction indexing stay offchain. Contract events are the source for those views. The payout order and financial rules must be fixed at activation; no owner should be able to replace a recipient or change deadlines for an active circle.
+
+Use USDC base units carefully: on chains where canonical USDC has 6 decimals, `$100` is `100_000_000`, but validate the selected token and hard-code or immutably configure the exact units rather than assuming every “USDC” token behaves identically.
+
+## Recommended funding and payout design
+
+### Full pre-funding (recommended)
+
+1. During enrollment, each listed member calls `fund(1_200e6)` (optionally via a supported signature flow). Activation is possible only after all 14,400 USDC is present.
+2. `activate()` fixes `startTime`. It can be called by any member once the funding invariant is met, or activation can occur as part of the final funding transaction.
+3. At epoch `i`, member `members[i]` calls `claim(i)`. The contract verifies that the epoch has started and was not claimed, marks it claimed before the transfer, and sends exactly 1,200 USDC.
+4. A payout never depends on all members submitting a transaction that month: the money is already escrowed. If a recipient is offline, the payout remains claimable; later epochs do not need to wait.
+5. After the final epoch and all claims, any explicitly defined dust can be withdrawn pro rata. There should be no general owner withdrawal.
+
+Under this design, “missed monthly payment” no longer exists onchain because the year's commitments were funded at activation. The monthly dates govern payout availability, not collection. That is the cleanest way to preserve the promised $1,200 payout and eliminate counterparty default.
+
+### If monthly payments are non-negotiable
+
+Each member can call `contribute(epoch)` before a deadline, but a guaranteed payout then requires separate locked collateral. At minimum, after a member receives their pot, their locked collateral must cover all of their remaining $100 obligations. On a miss, `finalizeDefault(member, epoch)` consumes 100 USDC of that member's collateral for the current pot and permanently forfeits their future payout if that is the agreed rule.
+
+This is not equivalent to using “earlier contributions”: it is a distinct reserve that has not been paid out. The collateral schedule, refund conditions, multiple defaults, a member defaulting before versus after their turn, and surplus disposition all need formal invariants and tests. A conservative implementation locks each member's full 1,200 USDC commitment at activation; at that point monthly contributions are mostly a repayment/user-experience layer over pre-funded security.
+
+If members will not post adequate collateral, the contract must pay less than 1,200 USDC when someone defaults or wait for offchain recovery. The UI and terms must not claim guaranteed payouts.
+
+Avoid token “autopay” as the liveness solution. An allowance does not schedule a transaction, can be revoked, and is useless when the wallet lacks USDC. A keeper could call `transferFrom`, but only while balance and allowance exist.
+
+## Contract surface and invariants
+
+Suggested external functions for the pre-funded version:
+
+- `fund()` — listed member deposits exactly their remaining commitment before activation.
+- `activate()` — permissionless once all twelve commitments are fully funded.
+- `claim(uint8 epoch)` — pays the fixed recipient after that epoch begins; the recipient may call directly. Optionally allow anyone to trigger a payout that always transfers to the recipient.
+- `refundBeforeActivation()` — available only after an enrollment timeout if full funding never occurs.
+- `emergencyExit()` — only for a deliberately specified terminal failure mode; it must preserve pro-rata ownership and must not let an admin seize funds.
+
+Critical invariants:
+
+- total successful scheduled claims never exceeds 12, and each epoch pays once;
+- each successful claim transfers exactly 1,200 USDC to the immutable recipient for that epoch;
+- activation requires exactly 14,400 USDC of member commitments accounted for;
+- claims can occur in any order after their respective release times, so one inactive recipient cannot block later recipients;
+- checks/effects/interactions and reentrancy protection apply to every transfer;
+- fee-on-transfer, rebasing, upgradeable, bridged lookalike, or blacklist-prone token behavior is not silently assumed away; support only the selected canonical token and test its real integration;
+- no pause, admin, or upgrade key can indefinitely strand an active circle's scheduled payouts.
+
+Use timestamp-derived eligibility, but store claim status. Do not require a monthly `advanceEpoch()` transaction. Where the monthly-payment variant needs deadline processing, let any participant finalize a specific expired epoch and make the call idempotent; avoid an unbounded loop over all members or months.
+
+## Who advances state
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `fund()` | each member | required to join and make the circle activate | circle remains inactive; after timeout, members refund themselves |
+| `activate()` | final funder or any member | starts the circle they joined | funds remain safe and activation remains callable |
+| `claim(epoch)` | scheduled recipient, or anyone if payout destination is fixed | recipient receives 1,200 USDC; a friend may sponsor gas | that epoch's pot remains claimable and later epochs are not blocked |
+| `refundBeforeActivation()` | depositor | recovers their own funds from a failed enrollment | funds remain withdrawable by that depositor |
+| `contribute(epoch)` (monthly variant) | member | preserves eligibility and collateral | after grace period, a permissionless default finalizer can use collateral |
+| `finalizeDefault(member, epoch)` (monthly variant) | any participant, preferably the current recipient | completes their pot and records the default | settlement waits, but funds remain safe and the call stays available |
+
+No row depends on a builder, owner, hosted frontend, or proprietary bot. A keeper may improve convenience, but participants retain a direct contract call path through a block explorer or a static fallback page.
+
+## What happens during the six-week absence
+
+For the recommended pre-funded contract, already activated circles keep working. Epoch eligibility follows timestamps. Recipients submit their own claim transactions; if nobody submits one, nothing is lost or reassigned—the claim waits. Later recipients can claim once their own epochs open. The builders' API, frontend, database, and reminder service may all be down without stopping contract settlement.
+
+They do **not** keep working unattended merely because the logic says “monthly.” Exact failure modes in a typical admin/automation-dependent implementation are:
+
+- If a backend or multisig must call `advanceMonth`, the circle remains in the old epoch until someone with that authority returns.
+- If a bot pulls USDC with `transferFrom`, collection stops when the bot stops; it also fails for revoked/insufficient allowances or balances.
+- If only an owner can mark defaults or skip a recipient, the first missed deadline blocks settlement or leaves the pot short.
+- If payouts are push transactions run by the builders, recipients receive nothing while the sender is offline even if accounting is correct.
+- If epoch `n+1` requires epoch `n` to be claimed, one absent recipient blocks everyone behind them.
+- If an owner-only pause is active or an upgrade/migration is required, user funds may be stranded until the signers return.
+- In an uncollateralized monthly design, the current pot is 100 USDC short for every missed payment. Forfeiting a future turn changes eligibility but does not manufacture the missing USDC.
+
+Before leaving, inspect the deployed bytecode/configuration—not just the intended source—and exercise every relevant public path on the actual target chain. Confirm that: all active circles are fully funded; payout destinations and order are correct; claims are permissionless or recipient-callable; later claims do not depend on earlier claims; no deadline transition is owner-only; the contract is unpaused; the frontend/RPC is not the only access route; and the multisig has enough independent available signers for genuinely necessary emergency actions. Publish verified source, ABI, contract address, canonical USDC address, and a one-page block-explorer claim/refund guide to members.
+
+If an already deployed circle fails any of those checks, an immutable contract cannot be repaired in place. The remedy is to execute any safe existing settlement/refund path before departure, or—with every member's informed consent—migrate balances to a reviewed replacement. Do not upgrade or move member funds under vague emergency authority. If the only problem is an optional bot or frontend, deploy redundant automation and a static interface, but preserve direct calls as the real fallback.
+
+## Target, testing, and handoff
+
+Choose one chain only after confirming where these members already hold canonical USDC and can reliably obtain gas. A low-fee Ethereum L2 is likely appropriate for twelve recurring users, but the actual chain should be selected from that user/liquidity constraint and current measured transaction fees—not from a generic “L2s are cheap” assumption. Do not launch until the chain, canonical USDC address, finality expectations, and bridge/support burden are fixed.
+
+Tests should cover all 12 epochs, exact six-decimal accounting, out-of-order claims, double claims, boundary timestamps, incomplete enrollment refunds, reentrancy, direct token transfers/dust, and every unauthorized admin attempt. The collateralized variant additionally needs property/fuzz tests proving that all remaining promised payouts stay solvent under every ordering and combination of defaults. Fork-test against the canonical USDC deployment.
+
+Production handoff should include verified contracts, reproducible deploy and verification commands, immutable constructor arguments, the deployment transaction, and a post-deploy smoke test that funds and claims a disposable test circle end to end. Any emergency role should belong to an appropriately configured multisig, never either builder's EOA, and its powers and unavailable-signer procedure should be disclosed to members. Obtain an independent review before accepting real deposits.
+

diff --git a/artifacts/ship-quiz-003/2026-08-24T210611Z-codex-with-skill-3/workspace/plan.md b/artifacts/ship-quiz-003/2026-08-24T210611Z-codex-with-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..35857eb79fa5a10c0aeef5dda7a5f81f3246eeab
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-08-24T210611Z-codex-with-skill-3/workspace/plan.md
@@ -0,0 +1,109 @@
+# Onchain susu: contract and six-week absence plan
+
+## Bottom line
+
+Running circles can continue while both builders are away **only if every required transition is callable by participants (or permissionlessly), and the contract already holds enough USDC to honor defaults**. A contract does not wake up when a month ends. A web server, cron job, or owner account may make settlement convenient, but it cannot be the sole liveness path.
+
+There is also an economic flaw in the proposed rule as stated: earlier monthly contributions cannot cover a later missed payment after those contributions have already been included in earlier $1,200 payouts. The same USDC cannot be paid out twice. “Forfeit their turn” limits the defaulter's benefit, but does not restore money already paid or guarantee later recipients. The circle must either pre-fund obligations, lock separate collateral, accept underfunded payouts, or rely on offchain collection.
+
+For a trust-minimized first version, I recommend full pre-funding: each of the 12 members escrows 1,200 USDC before activation. It is simple, guarantees every payout, and requires no credit or liquidation system. If monthly cash flow is essential, use the collateralized variant described below and be explicit that it requires materially more contract and product complexity.
+
+## Minimal architecture
+
+Deploy one custom `SusuCircle` contract for a single circle. Do not add a factory for the first release; deploy another instance when needed. Use the canonical USDC contract and OpenZeppelin `SafeERC20`, `ReentrancyGuard`, and immutable configuration.
+
+Onchain state should contain:
+
+- the 12 member addresses in their fixed payout order;
+- USDC token address, 100 USDC monthly unit, 1,200 USDC pot, start time, and month/epoch duration;
+- activation state, each member's funded balance, default/forfeiture status, and a bitmap or mapping of paid/claimed epochs;
+- an immutable grace period agreed before deposits;
+- emergency state whose powers are narrowly defined and cannot confiscate or reorder funds.
+
+Names, contact details, reminders, calendar displays, and transaction indexing stay offchain. Contract events are the source for those views. The payout order and financial rules must be fixed at activation; no owner should be able to replace a recipient or change deadlines for an active circle.
+
+Use USDC base units carefully: on chains where canonical USDC has 6 decimals, `$100` is `100_000_000`, but validate the selected token and hard-code or immutably configure the exact units rather than assuming every “USDC” token behaves identically.
+
+## Recommended funding and payout design
+
+### Full pre-funding (recommended)
+
+1. During enrollment, each listed member calls `fund(1_200e6)` (optionally via a supported signature flow). Activation is possible only after all 14,400 USDC is present.
+2. `activate()` fixes `startTime`. It can be called by any member once the funding invariant is met, or activation can occur as part of the final funding transaction.
+3. At epoch `i`, member `members[i]` calls `claim(i)`. The contract verifies that the epoch has started and was not claimed, marks it claimed before the transfer, and sends exactly 1,200 USDC.
+4. A payout never depends on all members submitting a transaction that month: the money is already escrowed. If a recipient is offline, the payout remains claimable; later epochs do not need to wait.
+5. After the final epoch and all claims, any explicitly defined dust can be withdrawn pro rata. There should be no general owner withdrawal.
+
+Under this design, “missed monthly payment” no longer exists onchain because the year's commitments were funded at activation. The monthly dates govern payout availability, not collection. That is the cleanest way to preserve the promised $1,200 payout and eliminate counterparty default.
+
+### If monthly payments are non-negotiable
+
+Each member can call `contribute(epoch)` before a deadline, but a guaranteed payout then requires separate locked collateral. At minimum, after a member receives their pot, their locked collateral must cover all of their remaining $100 obligations. On a miss, `finalizeDefault(member, epoch)` consumes 100 USDC of that member's collateral for the current pot and permanently forfeits their future payout if that is the agreed rule.
+
+This is not equivalent to using “earlier contributions”: it is a distinct reserve that has not been paid out. The collateral schedule, refund conditions, multiple defaults, a member defaulting before versus after their turn, and surplus disposition all need formal invariants and tests. A conservative implementation locks each member's full 1,200 USDC commitment at activation; at that point monthly contributions are mostly a repayment/user-experience layer over pre-funded security.
+
+If members will not post adequate collateral, the contract must pay less than 1,200 USDC when someone defaults or wait for offchain recovery. The UI and terms must not claim guaranteed payouts.
+
+Avoid token “autopay” as the liveness solution. An allowance does not schedule a transaction, can be revoked, and is useless when the wallet lacks USDC. A keeper could call `transferFrom`, but only while balance and allowance exist.
+
+## Contract surface and invariants
+
+Suggested external functions for the pre-funded version:
+
+- `fund()` — listed member deposits exactly their remaining commitment before activation.
+- `activate()` — permissionless once all twelve commitments are fully funded.
+- `claim(uint8 epoch)` — pays the fixed recipient after that epoch begins; the recipient may call directly. Optionally allow anyone to trigger a payout that always transfers to the recipient.
+- `refundBeforeActivation()` — available only after an enrollment timeout if full funding never occurs.
+- `emergencyExit()` — only for a deliberately specified terminal failure mode; it must preserve pro-rata ownership and must not let an admin seize funds.
+
+Critical invariants:
+
+- total successful scheduled claims never exceeds 12, and each epoch pays once;
+- each successful claim transfers exactly 1,200 USDC to the immutable recipient for that epoch;
+- activation requires exactly 14,400 USDC of member commitments accounted for;
+- claims can occur in any order after their respective release times, so one inactive recipient cannot block later recipients;
+- checks/effects/interactions and reentrancy protection apply to every transfer;
+- fee-on-transfer, rebasing, upgradeable, bridged lookalike, or blacklist-prone token behavior is not silently assumed away; support only the selected canonical token and test its real integration;
+- no pause, admin, or upgrade key can indefinitely strand an active circle's scheduled payouts.
+
+Use timestamp-derived eligibility, but store claim status. Do not require a monthly `advanceEpoch()` transaction. Where the monthly-payment variant needs deadline processing, let any participant finalize a specific expired epoch and make the call idempotent; avoid an unbounded loop over all members or months.
+
+## Who advances state
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `fund()` | each member | required to join and make the circle activate | circle remains inactive; after timeout, members refund themselves |
+| `activate()` | final funder or any member | starts the circle they joined | funds remain safe and activation remains callable |
+| `claim(epoch)` | scheduled recipient, or anyone if payout destination is fixed | recipient receives 1,200 USDC; a friend may sponsor gas | that epoch's pot remains claimable and later epochs are not blocked |
+| `refundBeforeActivation()` | depositor | recovers their own funds from a failed enrollment | funds remain withdrawable by that depositor |
+| `contribute(epoch)` (monthly variant) | member | preserves eligibility and collateral | after grace period, a permissionless default finalizer can use collateral |
+| `finalizeDefault(member, epoch)` (monthly variant) | any participant, preferably the current recipient | completes their pot and records the default | settlement waits, but funds remain safe and the call stays available |
+
+No row depends on a builder, owner, hosted frontend, or proprietary bot. A keeper may improve convenience, but participants retain a direct contract call path through a block explorer or a static fallback page.
+
+## What happens during the six-week absence
+
+For the recommended pre-funded contract, already activated circles keep working. Epoch eligibility follows timestamps. Recipients submit their own claim transactions; if nobody submits one, nothing is lost or reassigned—the claim waits. Later recipients can claim once their own epochs open. The builders' API, frontend, database, and reminder service may all be down without stopping contract settlement.
+
+They do **not** keep working unattended merely because the logic says “monthly.” Exact failure modes in a typical admin/automation-dependent implementation are:
+
+- If a backend or multisig must call `advanceMonth`, the circle remains in the old epoch until someone with that authority returns.
+- If a bot pulls USDC with `transferFrom`, collection stops when the bot stops; it also fails for revoked/insufficient allowances or balances.
+- If only an owner can mark defaults or skip a recipient, the first missed deadline blocks settlement or leaves the pot short.
+- If payouts are push transactions run by the builders, recipients receive nothing while the sender is offline even if accounting is correct.
+- If epoch `n+1` requires epoch `n` to be claimed, one absent recipient blocks everyone behind them.
+- If an owner-only pause is active or an upgrade/migration is required, user funds may be stranded until the signers return.
+- In an uncollateralized monthly design, the current pot is 100 USDC short for every missed payment. Forfeiting a future turn changes eligibility but does not manufacture the missing USDC.
+
+Before leaving, inspect the deployed bytecode/configuration—not just the intended source—and exercise every relevant public path on the actual target chain. Confirm that: all active circles are fully funded; payout destinations and order are correct; claims are permissionless or recipient-callable; later claims do not depend on earlier claims; no deadline transition is owner-only; the contract is unpaused; the frontend/RPC is not the only access route; and the multisig has enough independent available signers for genuinely necessary emergency actions. Publish verified source, ABI, contract address, canonical USDC address, and a one-page block-explorer claim/refund guide to members.
+
+If an already deployed circle fails any of those checks, an immutable contract cannot be repaired in place. The remedy is to execute any safe existing settlement/refund path before departure, or—with every member's informed consent—migrate balances to a reviewed replacement. Do not upgrade or move member funds under vague emergency authority. If the only problem is an optional bot or frontend, deploy redundant automation and a static interface, but preserve direct calls as the real fallback.
+
+## Target, testing, and handoff
+
+Choose one chain only after confirming where these members already hold canonical USDC and can reliably obtain gas. A low-fee Ethereum L2 is likely appropriate for twelve recurring users, but the actual chain should be selected from that user/liquidity constraint and current measured transaction fees—not from a generic “L2s are cheap” assumption. Do not launch until the chain, canonical USDC address, finality expectations, and bridge/support burden are fixed.
+
+Tests should cover all 12 epochs, exact six-decimal accounting, out-of-order claims, double claims, boundary timestamps, incomplete enrollment refunds, reentrancy, direct token transfers/dust, and every unauthorized admin attempt. The collateralized variant additionally needs property/fuzz tests proving that all remaining promised payouts stay solvent under every ordering and combination of defaults. Fork-test against the canonical USDC deployment.
+
+Production handoff should include verified contracts, reproducible deploy and verification commands, immutable constructor arguments, the deployment transaction, and a post-deploy smoke test that funds and claims a disposable test circle end to end. Any emergency role should belong to an appropriately configured multisig, never either builder's EOA, and its powers and unavailable-signer procedure should be disclosed to members. Obtain an independent review before accepting real deposits.
+

2026-08-24T21:07:15.739942Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 97 column 5
exec
/bin/bash -lc "wc -l plan.md && sed -n '1,32p' plan.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-003/2026-08-24T210611Z-codex-with-skill-3/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
109 plan.md
# Onchain susu: contract and six-week absence plan

## Bottom line

Running circles can continue while both builders are away **only if every required transition is callable by participants (or permissionlessly), and the contract already holds enough USDC to honor defaults**. A contract does not wake up when a month ends. A web server, cron job, or owner account may make settlement convenient, but it cannot be the sole liveness path.

There is also an economic flaw in the proposed rule as stated: earlier monthly contributions cannot cover a later missed payment after those contributions have already been included in earlier $1,200 payouts. The same USDC cannot be paid out twice. “Forfeit their turn” limits the defaulter's benefit, but does not restore money already paid or guarantee later recipients. The circle must either pre-fund obligations, lock separate collateral, accept underfunded payouts, or rely on offchain collection.

For a trust-minimized first version, I recommend full pre-funding: each of the 12 members escrows 1,200 USDC before activation. It is simple, guarantees every payout, and requires no credit or liquidation system. If monthly cash flow is essential, use the collateralized variant described below and be explicit that it requires materially more contract and product complexity.

## Minimal architecture

Deploy one custom `SusuCircle` contract for a single circle. Do not add a factory for the first release; deploy another instance when needed. Use the canonical USDC contract and OpenZeppelin `SafeERC20`, `ReentrancyGuard`, and immutable configuration.

Onchain state should contain:

- the 12 member addresses in their fixed payout order;
- USDC token address, 100 USDC monthly unit, 1,200 USDC pot, start time, and month/epoch duration;
- activation state, each member's funded balance, default/forfeiture status, and a bitmap or mapping of paid/claimed epochs;
- an immutable grace period agreed before deposits;
- emergency state whose powers are narrowly defined and cannot confiscate or reorder funds.

Names, contact details, reminders, calendar displays, and transaction indexing stay offchain. Contract events are the source for those views. The payout order and financial rules must be fixed at activation; no owner should be able to replace a recipient or change deadlines for an active circle.

Use USDC base units carefully: on chains where canonical USDC has 6 decimals, `$100` is `100_000_000`, but validate the selected token and hard-code or immutably configure the exact units rather than assuming every “USDC” token behaves identically.

## Recommended funding and payout design

### Full pre-funding (recommended)

1. During enrollment, each listed member calls `fund(1_200e6)` (optionally via a supported signature flow). Activation is possible only after all 14,400 USDC is present.
2. `activate()` fixes `startTime`. It can be called by any member once the funding invariant is met, or activation can occur as part of the final funding transaction.

diff --git a/artifacts/ship-quiz-003/2026-08-24T210611Z-codex-with-skill-3/workspace/plan.md b/artifacts/ship-quiz-003/2026-08-24T210611Z-codex-with-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..35857eb79fa5a10c0aeef5dda7a5f81f3246eeab
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-08-24T210611Z-codex-with-skill-3/workspace/plan.md
@@ -0,0 +1,109 @@
+# Onchain susu: contract and six-week absence plan
+
+## Bottom line
+
+Running circles can continue while both builders are away **only if every required transition is callable by participants (or permissionlessly), and the contract already holds enough USDC to honor defaults**. A contract does not wake up when a month ends. A web server, cron job, or owner account may make settlement convenient, but it cannot be the sole liveness path.
+
+There is also an economic flaw in the proposed rule as stated: earlier monthly contributions cannot cover a later missed payment after those contributions have already been included in earlier $1,200 payouts. The same USDC cannot be paid out twice. “Forfeit their turn” limits the defaulter's benefit, but does not restore money already paid or guarantee later recipients. The circle must either pre-fund obligations, lock separate collateral, accept underfunded payouts, or rely on offchain collection.
+
+For a trust-minimized first version, I recommend full pre-funding: each of the 12 members escrows 1,200 USDC before activation. It is simple, guarantees every payout, and requires no credit or liquidation system. If monthly cash flow is essential, use the collateralized variant described below and be explicit that it requires materially more contract and product complexity.
+
+## Minimal architecture
+
+Deploy one custom `SusuCircle` contract for a single circle. Do not add a factory for the first release; deploy another instance when needed. Use the canonical USDC contract and OpenZeppelin `SafeERC20`, `ReentrancyGuard`, and immutable configuration.
+
+Onchain state should contain:
+
+- the 12 member addresses in their fixed payout order;
+- USDC token address, 100 USDC monthly unit, 1,200 USDC pot, start time, and month/epoch duration;
+- activation state, each member's funded balance, default/forfeiture status, and a bitmap or mapping of paid/claimed epochs;
+- an immutable grace period agreed before deposits;
+- emergency state whose powers are narrowly defined and cannot confiscate or reorder funds.
+
+Names, contact details, reminders, calendar displays, and transaction indexing stay offchain. Contract events are the source for those views. The payout order and financial rules must be fixed at activation; no owner should be able to replace a recipient or change deadlines for an active circle.
+
+Use USDC base units carefully: on chains where canonical USDC has 6 decimals, `$100` is `100_000_000`, but validate the selected token and hard-code or immutably configure the exact units rather than assuming every “USDC” token behaves identically.
+
+## Recommended funding and payout design
+
+### Full pre-funding (recommended)
+
+1. During enrollment, each listed member calls `fund(1_200e6)` (optionally via a supported signature flow). Activation is possible only after all 14,400 USDC is present.
+2. `activate()` fixes `startTime`. It can be called by any member once the funding invariant is met, or activation can occur as part of the final funding transaction.
+3. At epoch `i`, member `members[i]` calls `claim(i)`. The contract verifies that the epoch has started and was not claimed, marks it claimed before the transfer, and sends exactly 1,200 USDC.
+4. A payout never depends on all members submitting a transaction that month: the money is already escrowed. If a recipient is offline, the payout remains claimable; later epochs do not need to wait.
+5. After the final epoch and all claims, any explicitly defined dust can be withdrawn pro rata. There should be no general owner withdrawal.
+
+Under this design, “missed monthly payment” no longer exists onchain because the year's commitments were funded at activation. The monthly dates govern payout availability, not collection. That is the cleanest way to preserve the promised $1,200 payout and eliminate counterparty default.
+
+### If monthly payments are non-negotiable
+
+Each member can call `contribute(epoch)` before a deadline, but a guaranteed payout then requires separate locked collateral. At minimum, after a member receives their pot, their locked collateral must cover all of their remaining $100 obligations. On a miss, `finalizeDefault(member, epoch)` consumes 100 USDC of that member's collateral for the current pot and permanently forfeits their future payout if that is the agreed rule.
+
+This is not equivalent to using “earlier contributions”: it is a distinct reserve that has not been paid out. The collateral schedule, refund conditions, multiple defaults, a member defaulting before versus after their turn, and surplus disposition all need formal invariants and tests. A conservative implementation locks each member's full 1,200 USDC commitment at activation; at that point monthly contributions are mostly a repayment/user-experience layer over pre-funded security.
+
+If members will not post adequate collateral, the contract must pay less than 1,200 USDC when someone defaults or wait for offchain recovery. The UI and terms must not claim guaranteed payouts.
+
+Avoid token “autopay” as the liveness solution. An allowance does not schedule a transaction, can be revoked, and is useless when the wallet lacks USDC. A keeper could call `transferFrom`, but only while balance and allowance exist.
+
+## Contract surface and invariants
+
+Suggested external functions for the pre-funded version:
+
+- `fund()` — listed member deposits exactly their remaining commitment before activation.
+- `activate()` — permissionless once all twelve commitments are fully funded.
+- `claim(uint8 epoch)` — pays the fixed recipient after that epoch begins; the recipient may call directly. Optionally allow anyone to trigger a payout that always transfers to the recipient.
+- `refundBeforeActivation()` — available only after an enrollment timeout if full funding never occurs.
+- `emergencyExit()` — only for a deliberately specified terminal failure mode; it must preserve pro-rata ownership and must not let an admin seize funds.
+
+Critical invariants:
+
+- total successful scheduled claims never exceeds 12, and each epoch pays once;
+- each successful claim transfers exactly 1,200 USDC to the immutable recipient for that epoch;
+- activation requires exactly 14,400 USDC of member commitments accounted for;
+- claims can occur in any order after their respective release times, so one inactive recipient cannot block later recipients;
+- checks/effects/interactions and reentrancy protection apply to every transfer;
+- fee-on-transfer, rebasing, upgradeable, bridged lookalike, or blacklist-prone token behavior is not silently assumed away; support only the selected canonical token and test its real integration;
+- no pause, admin, or upgrade key can indefinitely strand an active circle's scheduled payouts.
+
+Use timestamp-derived eligibility, but store claim status. Do not require a monthly `advanceEpoch()` transaction. Where the monthly-payment variant needs deadline processing, let any participant finalize a specific expired epoch and make the call idempotent; avoid an unbounded loop over all members or months.
+
+## Who advances state
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `fund()` | each member | required to join and make the circle activate | circle remains inactive; after timeout, members refund themselves |
+| `activate()` | final funder or any member | starts the circle they joined | funds remain safe and activation remains callable |
+| `claim(epoch)` | scheduled recipient, or anyone if payout destination is fixed | recipient receives 1,200 USDC; a friend may sponsor gas | that epoch's pot remains claimable and later epochs are not blocked |
+| `refundBeforeActivation()` | depositor | recovers their own funds from a failed enrollment | funds remain withdrawable by that depositor |
+| `contribute(epoch)` (monthly variant) | member | preserves eligibility and collateral | after grace period, a permissionless default finalizer can use collateral |
+| `finalizeDefault(member, epoch)` (monthly variant) | any participant, preferably the current recipient | completes their pot and records the default | settlement waits, but funds remain safe and the call stays available |
+
+No row depends on a builder, owner, hosted frontend, or proprietary bot. A keeper may improve convenience, but participants retain a direct contract call path through a block explorer or a static fallback page.
+
+## What happens during the six-week absence
+
+For the recommended pre-funded contract, already activated circles keep working. Epoch eligibility follows timestamps. Recipients submit their own claim transactions; if nobody submits one, nothing is lost or reassigned—the claim waits. Later recipients can claim once their own epochs open. The builders' API, frontend, database, and reminder service may all be down without stopping contract settlement.
+
+They do **not** keep working unattended merely because the logic says “monthly.” Exact failure modes in a typical admin/automation-dependent implementation are:
+
+- If a backend or multisig must call `advanceMonth`, the circle remains in the old epoch until someone with that authority returns.
+- If a bot pulls USDC with `transferFrom`, collection stops when the bot stops; it also fails for revoked/insufficient allowances or balances.
+- If only an owner can mark defaults or skip a recipient, the first missed deadline blocks settlement or leaves the pot short.
+- If payouts are push transactions run by the builders, recipients receive nothing while the sender is offline even if accounting is correct.
+- If epoch `n+1` requires epoch `n` to be claimed, one absent recipient blocks everyone behind them.
+- If an owner-only pause is active or an upgrade/migration is required, user funds may be stranded until the signers return.
+- In an uncollateralized monthly design, the current pot is 100 USDC short for every missed payment. Forfeiting a future turn changes eligibility but does not manufacture the missing USDC.
+
+Before leaving, inspect the deployed bytecode/configuration—not just the intended source—and exercise every relevant public path on the actual target chain. Confirm that: all active circles are fully funded; payout destinations and order are correct; claims are permissionless or recipient-callable; later claims do not depend on earlier claims; no deadline transition is owner-only; the contract is unpaused; the frontend/RPC is not the only access route; and the multisig has enough independent available signers for genuinely necessary emergency actions. Publish verified source, ABI, contract address, canonical USDC address, and a one-page block-explorer claim/refund guide to members.
+
+If an already deployed circle fails any of those checks, an immutable contract cannot be repaired in place. The remedy is to execute any safe existing settlement/refund path before departure, or—with every member's informed consent—migrate balances to a reviewed replacement. Do not upgrade or move member funds under vague emergency authority. If the only problem is an optional bot or frontend, deploy redundant automation and a static interface, but preserve direct calls as the real fallback.
+
+## Target, testing, and handoff
+
+Choose one chain only after confirming where these members already hold canonical USDC and can reliably obtain gas. A low-fee Ethereum L2 is likely appropriate for twelve recurring users, but the actual chain should be selected from that user/liquidity constraint and current measured transaction fees—not from a generic “L2s are cheap” assumption. Do not launch until the chain, canonical USDC address, finality expectations, and bridge/support burden are fixed.
+
+Tests should cover all 12 epochs, exact six-decimal accounting, out-of-order claims, double claims, boundary timestamps, incomplete enrollment refunds, reentrancy, direct token transfers/dust, and every unauthorized admin attempt. The collateralized variant additionally needs property/fuzz tests proving that all remaining promised payouts stay solvent under every ordering and combination of defaults. Fork-test against the canonical USDC deployment.
+
+Production handoff should include verified contracts, reproducible deploy and verification commands, immutable constructor arguments, the deployment transaction, and a post-deploy smoke test that funds and claims a disposable test circle end to end. Any emergency role should belong to an appropriately configured multisig, never either builder's EOA, and its powers and unavailable-signer procedure should be disclosed to members. Obtain an independent review before accepting real deposits.
+

2026-08-24T21:07:18.854650Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 97 column 5
codex
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-003/2026-08-24T210611Z-codex-with-skill-3/workspace/plan.md).

It covers the contract design, solvency issue with missed payments, recommended pre-funding/collateral model, caller and incentive table, exact six-week liveness failures, testing, and operational handoff.
diff --git a/artifacts/ship-quiz-003/2026-08-24T210611Z-codex-with-skill-3/workspace/plan.md b/artifacts/ship-quiz-003/2026-08-24T210611Z-codex-with-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..35857eb79fa5a10c0aeef5dda7a5f81f3246eeab
--- /dev/null
+++ b/artifacts/ship-quiz-003/2026-08-24T210611Z-codex-with-skill-3/workspace/plan.md
@@ -0,0 +1,109 @@
+# Onchain susu: contract and six-week absence plan
+
+## Bottom line
+
+Running circles can continue while both builders are away **only if every required transition is callable by participants (or permissionlessly), and the contract already holds enough USDC to honor defaults**. A contract does not wake up when a month ends. A web server, cron job, or owner account may make settlement convenient, but it cannot be the sole liveness path.
+
+There is also an economic flaw in the proposed rule as stated: earlier monthly contributions cannot cover a later missed payment after those contributions have already been included in earlier $1,200 payouts. The same USDC cannot be paid out twice. “Forfeit their turn” limits the defaulter's benefit, but does not restore money already paid or guarantee later recipients. The circle must either pre-fund obligations, lock separate collateral, accept underfunded payouts, or rely on offchain collection.
+
+For a trust-minimized first version, I recommend full pre-funding: each of the 12 members escrows 1,200 USDC before activation. It is simple, guarantees every payout, and requires no credit or liquidation system. If monthly cash flow is essential, use the collateralized variant described below and be explicit that it requires materially more contract and product complexity.
+
+## Minimal architecture
+
+Deploy one custom `SusuCircle` contract for a single circle. Do not add a factory for the first release; deploy another instance when needed. Use the canonical USDC contract and OpenZeppelin `SafeERC20`, `ReentrancyGuard`, and immutable configuration.
+
+Onchain state should contain:
+
+- the 12 member addresses in their fixed payout order;
+- USDC token address, 100 USDC monthly unit, 1,200 USDC pot, start time, and month/epoch duration;
+- activation state, each member's funded balance, default/forfeiture status, and a bitmap or mapping of paid/claimed epochs;
+- an immutable grace period agreed before deposits;
+- emergency state whose powers are narrowly defined and cannot confiscate or reorder funds.
+
+Names, contact details, reminders, calendar displays, and transaction indexing stay offchain. Contract events are the source for those views. The payout order and financial rules must be fixed at activation; no owner should be able to replace a recipient or change deadlines for an active circle.
+
+Use USDC base units carefully: on chains where canonical USDC has 6 decimals, `$100` is `100_000_000`, but validate the selected token and hard-code or immutably configure the exact units rather than assuming every “USDC” token behaves identically.
+
+## Recommended funding and payout design
+
+### Full pre-funding (recommended)
+
+1. During enrollment, each listed member calls `fund(1_200e6)` (optionally via a supported signature flow). Activation is possible only after all 14,400 USDC is present.
+2. `activate()` fixes `startTime`. It can be called by any member once the funding invariant is met, or activation can occur as part of the final funding transaction.
+3. At epoch `i`, member `members[i]` calls `claim(i)`. The contract verifies that the epoch has started and was not claimed, marks it claimed before the transfer, and sends exactly 1,200 USDC.
+4. A payout never depends on all members submitting a transaction that month: the money is already escrowed. If a recipient is offline, the payout remains claimable; later epochs do not need to wait.
+5. After the final epoch and all claims, any explicitly defined dust can be withdrawn pro rata. There should be no general owner withdrawal.
+
+Under this design, “missed monthly payment” no longer exists onchain because the year's commitments were funded at activation. The monthly dates govern payout availability, not collection. That is the cleanest way to preserve the promised $1,200 payout and eliminate counterparty default.
+
+### If monthly payments are non-negotiable
+
+Each member can call `contribute(epoch)` before a deadline, but a guaranteed payout then requires separate locked collateral. At minimum, after a member receives their pot, their locked collateral must cover all of their remaining $100 obligations. On a miss, `finalizeDefault(member, epoch)` consumes 100 USDC of that member's collateral for the current pot and permanently forfeits their future payout if that is the agreed rule.
+
+This is not equivalent to using “earlier contributions”: it is a distinct reserve that has not been paid out. The collateral schedule, refund conditions, multiple defaults, a member defaulting before versus after their turn, and surplus disposition all need formal invariants and tests. A conservative implementation locks each member's full 1,200 USDC commitment at activation; at that point monthly contributions are mostly a repayment/user-experience layer over pre-funded security.
+
+If members will not post adequate collateral, the contract must pay less than 1,200 USDC when someone defaults or wait for offchain recovery. The UI and terms must not claim guaranteed payouts.
+
+Avoid token “autopay” as the liveness solution. An allowance does not schedule a transaction, can be revoked, and is useless when the wallet lacks USDC. A keeper could call `transferFrom`, but only while balance and allowance exist.
+
+## Contract surface and invariants
+
+Suggested external functions for the pre-funded version:
+
+- `fund()` — listed member deposits exactly their remaining commitment before activation.
+- `activate()` — permissionless once all twelve commitments are fully funded.
+- `claim(uint8 epoch)` — pays the fixed recipient after that epoch begins; the recipient may call directly. Optionally allow anyone to trigger a payout that always transfers to the recipient.
+- `refundBeforeActivation()` — available only after an enrollment timeout if full funding never occurs.
+- `emergencyExit()` — only for a deliberately specified terminal failure mode; it must preserve pro-rata ownership and must not let an admin seize funds.
+
+Critical invariants:
+
+- total successful scheduled claims never exceeds 12, and each epoch pays once;
+- each successful claim transfers exactly 1,200 USDC to the immutable recipient for that epoch;
+- activation requires exactly 14,400 USDC of member commitments accounted for;
+- claims can occur in any order after their respective release times, so one inactive recipient cannot block later recipients;
+- checks/effects/interactions and reentrancy protection apply to every transfer;
+- fee-on-transfer, rebasing, upgradeable, bridged lookalike, or blacklist-prone token behavior is not silently assumed away; support only the selected canonical token and test its real integration;
+- no pause, admin, or upgrade key can indefinitely strand an active circle's scheduled payouts.
+
+Use timestamp-derived eligibility, but store claim status. Do not require a monthly `advanceEpoch()` transaction. Where the monthly-payment variant needs deadline processing, let any participant finalize a specific expired epoch and make the call idempotent; avoid an unbounded loop over all members or months.
+
+## Who advances state
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `fund()` | each member | required to join and make the circle activate | circle remains inactive; after timeout, members refund themselves |
+| `activate()` | final funder or any member | starts the circle they joined | funds remain safe and activation remains callable |
+| `claim(epoch)` | scheduled recipient, or anyone if payout destination is fixed | recipient receives 1,200 USDC; a friend may sponsor gas | that epoch's pot remains claimable and later epochs are not blocked |
+| `refundBeforeActivation()` | depositor | recovers their own funds from a failed enrollment | funds remain withdrawable by that depositor |
+| `contribute(epoch)` (monthly variant) | member | preserves eligibility and collateral | after grace period, a permissionless default finalizer can use collateral |
+| `finalizeDefault(member, epoch)` (monthly variant) | any participant, preferably the current recipient | completes their pot and records the default | settlement waits, but funds remain safe and the call stays available |
+
+No row depends on a builder, owner, hosted frontend, or proprietary bot. A keeper may improve convenience, but participants retain a direct contract call path through a block explorer or a static fallback page.
+
+## What happens during the six-week absence
+
+For the recommended pre-funded contract, already activated circles keep working. Epoch eligibility follows timestamps. Recipients submit their own claim transactions; if nobody submits one, nothing is lost or reassigned—the claim waits. Later recipients can claim once their own epochs open. The builders' API, frontend, database, and reminder service may all be down without stopping contract settlement.
+
+They do **not** keep working unattended merely because the logic says “monthly.” Exact failure modes in a typical admin/automation-dependent implementation are:
+
+- If a backend or multisig must call `advanceMonth`, the circle remains in the old epoch until someone with that authority returns.
+- If a bot pulls USDC with `transferFrom`, collection stops when the bot stops; it also fails for revoked/insufficient allowances or balances.
+- If only an owner can mark defaults or skip a recipient, the first missed deadline blocks settlement or leaves the pot short.
+- If payouts are push transactions run by the builders, recipients receive nothing while the sender is offline even if accounting is correct.
+- If epoch `n+1` requires epoch `n` to be claimed, one absent recipient blocks everyone behind them.
+- If an owner-only pause is active or an upgrade/migration is required, user funds may be stranded until the signers return.
+- In an uncollateralized monthly design, the current pot is 100 USDC short for every missed payment. Forfeiting a future turn changes eligibility but does not manufacture the missing USDC.
+
+Before leaving, inspect the deployed bytecode/configuration—not just the intended source—and exercise every relevant public path on the actual target chain. Confirm that: all active circles are fully funded; payout destinations and order are correct; claims are permissionless or recipient-callable; later claims do not depend on earlier claims; no deadline transition is owner-only; the contract is unpaused; the frontend/RPC is not the only access route; and the multisig has enough independent available signers for genuinely necessary emergency actions. Publish verified source, ABI, contract address, canonical USDC address, and a one-page block-explorer claim/refund guide to members.
+
+If an already deployed circle fails any of those checks, an immutable contract cannot be repaired in place. The remedy is to execute any safe existing settlement/refund path before departure, or—with every member's informed consent—migrate balances to a reviewed replacement. Do not upgrade or move member funds under vague emergency authority. If the only problem is an optional bot or frontend, deploy redundant automation and a static interface, but preserve direct calls as the real fallback.
+
+## Target, testing, and handoff
+
+Choose one chain only after confirming where these members already hold canonical USDC and can reliably obtain gas. A low-fee Ethereum L2 is likely appropriate for twelve recurring users, but the actual chain should be selected from that user/liquidity constraint and current measured transaction fees—not from a generic “L2s are cheap” assumption. Do not launch until the chain, canonical USDC address, finality expectations, and bridge/support burden are fixed.
+
+Tests should cover all 12 epochs, exact six-decimal accounting, out-of-order claims, double claims, boundary timestamps, incomplete enrollment refunds, reentrancy, direct token transfers/dust, and every unauthorized admin attempt. The collateralized variant additionally needs property/fuzz tests proving that all remaining promised payouts stay solvent under every ordering and combination of defaults. Fork-test against the canonical USDC deployment.
+
+Production handoff should include verified contracts, reproducible deploy and verification commands, immutable constructor arguments, the deployment transaction, and a post-deploy smoke test that funds and claims a disposable test circle end to end. Any emergency role should belong to an appropriately configured multisig, never either builder's EOA, and its powers and unavailable-signer procedure should be disclosed to members. Obtain an independent review before accepting real deposits.
+

tokens used
17,466
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-003/2026-08-24T210611Z-codex-with-skill-3/workspace/plan.md).

It covers the contract design, solvency issue with missed payments, recommended pre-funding/collateral model, caller and incentive table, exact six-week liveness failures, testing, and operational handoff.
