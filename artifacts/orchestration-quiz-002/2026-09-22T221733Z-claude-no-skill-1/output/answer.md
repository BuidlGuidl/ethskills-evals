# Early-Withdrawal Fee Decimals Bug — Fix Plan

**Status:** confirmed bug in the deployed vault on Base mainnet. Withdrawals below
~100 USDC are charged roughly 10x the intended early-withdrawal fee. ~$40k TVL,
contracts deployed and verified ~3 weeks ago. No principal at risk beyond the
overcharge.

---

## 1. Does the UI minimum resolve the incident?

**No.** It is a display change, not a fix, and it should not be the only thing we
ship. Three reasons, in order of importance:

**a. The frontend is not a security boundary.** The vault is a public contract on a
public chain. The buggy path stays reachable via Basescan's "Write Contract" tab,
any wallet's raw-transaction UI, a previously-open tab with the old bundle, an
aggregator or portfolio tracker that integrates us, a script, or anyone who has
already granted approvals. A UI minimum changes who *happens* to hit the bug, not
whether the bug exists. If a user is overcharged through any of those paths, "our
frontend had a minimum" is not a defense — we knew, and we left the contract live.

**b. It strands the harmed users.** The people being overcharged are, by
definition, the ones with small positions. A 100 USDC UI minimum means a user with
60 USDC staked cannot withdraw through our app *at all*. Their choices become:
leave funds in, or go around the UI and eat the 10x fee. We would be converting an
overcharge bug into a partial lockout of our smallest users, and doing it silently.
That is a worse incident than the one we have, and it is the kind of thing that
reads very badly in a post-mortem or a screenshot thread.

**c. It does nothing about money already taken.** Users have been withdrawing for
three weeks. Those overcharges are already collected. Any plan that does not
include quantifying and refunding them has not resolved the incident, it has only
stopped the bleeding.

**What the UI *can* honestly do today:** show the real, on-chain-computed fee in the
withdrawal preview (read it from the contract, don't recompute it in TS), plus a
banner disclosing the bug, the affected range, and our refund commitment. Warn and
require confirmation — do not hard-block.

The PM's underlying concern is right and I'm not dismissing it: a migration *is*
heavy, and we should avoid one if we can. But the way to avoid it is a contract-level
mitigation (§3), not a frontend gate.

---

## 2. Before anything else: re-derive the bug boundary (1–2 hours)

Do not take "under 100 USDC" as given. It is the threshold where users *noticed*,
which is not necessarily where the math breaks.

- Write a Foundry test that reproduces the overcharge, then fuzz `amount` across the
  full range and assert `feeCharged == expectedFee` to find the true boundary.
- Fork-test against Base at a recent block using the live deployed address, so we
  are testing the actual bytecode, not a local re-deploy.
- Identify the exact defect. "Wrong decimals scale" with a ~10x error smells like a
  hardcoded divisor (`1e3` vs `1e4` in a bps calc) rather than a true 6-vs-18
  decimal mismatch — a real USDC decimals mixup would be off by ~1e12, not 10x. We
  need to know which, because it determines whether the error is bounded, whether it
  can round to zero, and whether it can *under*charge or revert at other amounts.
- Also check for the mirror bug: does the same miscomputation appear in deposit,
  in any fee-preview view function, or in accounting the protocol relies on?

If the boundary turns out not to be 100 USDC, that alone kills the UI-minimum plan
on its own terms — the gate would be protecting nobody.

---

## 3. Ship today

**Step 1 — Freeze.** No new deploys, no config changes to the vault until §2 is done.
Snapshot current state.

**Step 2 — Find the contract-level lever.** Read the deployed vault's admin surface
and check, in this order:

1. **Is there an owner-settable fee parameter** (`setEarlyWithdrawalFee`,
   `setFeeBps`, etc.)? If yes, **this is the real fix for today**: set the fee to
   **zero**. The overcharge disappears at the source, for every caller and every
   entry point, in one transaction, with no migration and no re-approvals. We lose
   fee revenue for a few days. That is a trivial price.
2. **Is the vault behind a proxy?** Scaffold-ETH 2's default scaffolding is not
   upgradeable, so assume no until confirmed — but confirm it, because if it *is*
   upgradeable the whole §4 migration collapses into an implementation upgrade.
3. **Is there a pause?** Note it, but **do not pause withdrawals.** Blocking people
   from their own funds is strictly worse than a bounded overcharge, and it is the
   action most likely to trigger a panic.

**Step 3 — Execute the lever.** If the fee setter exists: run it on a fork first,
then execute from the owner (route through the Safe if a multisig owns it; account
for any timelock delay in the timeline below). Verify on-chain that the fee now
reads zero and that a small withdrawal charges nothing.

**Step 4 — Ship the frontend changes.** Live fee preview read from the contract,
plus a disclosure banner. **No hard minimum.** If the fee was successfully zeroed in
Step 3, the banner becomes "fee temporarily disabled while we fix a bug; affected
users will be refunded," which is a much better message.

**Step 5 — Publish.** Short, factual status post: what the bug is, the affected
amount range, what we did today, that refunds are coming, and a date. Pin it in
Discord/X and link it from the banner. Disclosing this ourselves is far cheaper than
having it surfaced by a user.

**Step 6 — Build the refund ledger.** Index `Withdraw`/fee events from the deploy
block to now. For each, recompute the intended fee and diff against what was
actually charged. Produce a per-address list and a total. Sanity-check it against
the treasury's actual fee balance — the two should reconcile. Publish the
methodology alongside the numbers.

**If no fee setter exists and the vault is not upgradeable:** today's mitigation is
only Steps 4–6 (disclosure, honest preview, refund accounting), and §4 becomes
urgent rather than merely scheduled. Say so plainly, internally and publicly. Do not
let a UI gate create the impression that the incident is contained when it isn't.

---

## 4. Ship this week

**Step 7 — Fix and test the contract.** Correct the fee math. Keep the failing test
from §2 as a permanent regression test. Add a fuzz/invariant test asserting fee
correctness across the full amount range, and an explicit assertion on USDC's 6
decimals so a future decimals assumption can't drift silently.

**Step 8 — Review.** Internal review of the diff plus the surrounding fee and
accounting code, since a decimals error rarely travels alone. Given $40k TVL, a
full re-audit is not proportionate, but a second competent set of eyes on the diff
is mandatory.

**Step 9 — Deploy V2 and verify.** Deploy to Base, verify on Basescan immediately,
and update `deployedContracts.ts` so the Scaffold-ETH hooks pick it up.

**Step 10 — Migration, choosing the lightest path that actually works:**

- *If the vault is upgradeable:* upgrade the implementation. No migration, no
  re-approvals. Done.
- *If not, and the fee was zeroed in Step 3:* we are no longer under time pressure.
  Run **opt-in migration**: V2 ships, the UI defaults new deposits to V2 and prompts
  existing stakers to migrate, and V1 stays live indefinitely in fee-disabled state
  so nobody is ever forced to move to get their money. This is the PM's "avoid a
  heavy migration" concern satisfied honestly — we don't avoid the redeploy, we
  avoid the *forced* migration, which was the expensive part.
- *If not, and the fee could not be zeroed:* same opt-in migration, but actively
  push it — direct outreach to affected holders, and consider subsidizing gas for
  small positions, since those are the users the bug hit.

Do not build a permissioned "migrate on users' behalf" function. Giving ourselves
the power to move user funds to fix a fee bug is a much larger risk than the bug.

**Step 11 — Pay refunds.** Direct transfers if the list is short (likely, at this
TVL); a Merkle claim contract if it is long enough that gas matters. Publish the
transaction hashes. Refund from treasury regardless of whether the overcharged fees
are still sitting there.

**Step 12 — Post-mortem.** Public and short. The genuinely useful takeaway is
process, not the specific line of code: this shipped because nothing in the test
suite exercised small-amount withdrawals against a 6-decimal token. Add that class
of case to the standard pre-deploy checklist, and add a fork-test gate against
mainnet state before any future deploy.

---

## Ordering summary

| When | Step | Blocking? |
|---|---|---|
| Today, first | Reproduce + fuzz for true boundary (§2) | Blocks everything |
| Today | Zero the fee on-chain if a setter exists | The actual mitigation |
| Today | Honest fee preview + disclosure banner (no hard minimum) | Parallel |
| Today | Public status post | After the fee lever lands |
| Today | Build refund ledger from events | Parallel |
| This week | Fix, test, review, deploy + verify V2 | |
| This week | Opt-in migration, V1 left live fee-disabled | |
| This week | Pay refunds, publish hashes | |
| This week | Post-mortem + test-checklist change | |

**One-line answer for the PM:** the UI minimum doesn't resolve the incident — it
hides it from our own dashboard while locking small stakers out of their funds. If
the vault has an owner-settable fee, we get the fast path they want *and* a real
fix today by setting it to zero; the redeploy then happens this week without a
forced migration or new approvals.
