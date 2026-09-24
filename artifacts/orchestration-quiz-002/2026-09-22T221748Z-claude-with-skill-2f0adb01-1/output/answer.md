# Vault early-withdrawal fee bug — fix plan

**Status:** live on Base mainnet, ~$40k TVL, contracts deployed + verified ~3 weeks ago (2026-09-01). Confirmed 2026-09-21: early-withdrawal fee is computed at the wrong decimals scale; withdrawals under 100 USDC are charged ~10x the intended fee.

## Bottom line: does the UI minimum resolve the incident?

**No.** A 100 USDC minimum in the withdrawal form is a useful *mitigation* — ship it today — but it does not close the incident, for three reasons:

1. **The frontend is not the access control.** The vault is a public, verified contract on Base. Anyone can call `withdraw()` from Etherscan, a wallet's contract-interaction screen, a script, or a fork of our own UI. The bug stays reachable by every path except the one we patched.
2. **It doesn't undo the overcharge already taken.** Users who withdrew small amounts in the last three weeks were charged ~10x. That money is a liability regardless of what the form does going forward.
3. **It makes the product worse in a way users notice.** "You can't withdraw less than 100 USDC" is a real restriction on people who staked less than that — for some, it locks their entire position behind a minimum they can't meet. We'd be converting an overcharge bug into a partial freeze bug.

There's also a process rule here worth stating plainly: a contract bug found in production gets fixed in the contract. Frontend guards around bad onchain math are how a small, well-understood bug becomes a permanent undocumented invariant that the next person doesn't know about. The redeploy is heavy — migrating stakers, re-doing approvals — and that cost is real, but it's the cost of the actual fix, and it doesn't get cheaper by waiting. TVL and user count only go up.

So: UI minimum today as a bleed-stop, corrected contract this week.

---

## Today (mitigation + disclosure)

**T1. Ship the UI guard.** Add the 100 USDC minimum to the withdrawal form, with honest copy — not "minimum withdrawal 100 USDC" as if it were a product rule, but a visible banner: "We found a fee calculation bug affecting withdrawals under 100 USDC. Small withdrawals are temporarily disabled while we deploy a fix. Affected users will be refunded." Users who are told what's happening don't turn into a support incident.

**T2. Check for a contract-level pause.** If the vault has a pause/guardian function, evaluate pausing early withdrawals outright. This is the only mitigation that actually covers direct contract calls. Weigh it against the fact that pausing also blocks legitimate large withdrawals — if the pause isn't granular enough to hit only the broken path, the UI guard plus disclosure is the better tradeoff for a 1-week window.

**T3. Quantify the damage.** Pull the full `Withdraw`/fee event history from deployment block to now. Compute, per address: amount withdrawn, fee charged, fee that *should* have been charged, delta. This gives the total refund liability and the exact refund list. Do this today — it's the input to everything in step W6 and it's the number leadership will ask for.

**T4. Public disclosure.** Post to whatever channel the community lives in (Discord/X/docs): what the bug is, who's affected, that no principal is at risk beyond the overcharge, that refunds are coming, and the timeline. Getting ahead of "users are starting to notice" is worth more than a day of drafting.

---

## This week (the actual fix)

The bug is a Phase 2 (live contracts) defect, so it goes back to Phase 1 — fixed and tested locally against a fork, then redeployed.

**W1. Reproduce on a Base fork.** `yarn fork --network base`, deploy the *current* vault source, and write a test that fails: withdraw 50 USDC early, assert the charged fee equals the intended fee. Confirm it fails by ~10x. Do not fix anything until the failing test exists — otherwise there's no proof the redeploy actually fixed it.

**W2. Fix the decimals scaling** in the fee math. USDC is 6 decimals on Base; the bug is almost certainly an 18-decimal assumption or a mismatched scaling constant in the fee formula. Fix the root cause, not the boundary — don't add a `require(amount >= 100e6)` in the contract, which is the same mistake as the UI guard just written in Solidity.

**W3. Regression tests, then a fuzz test.** Table-test the fee at 1, 10, 50, 99, 100, 101, 1000, and dust amounts. Add a foundry fuzz/invariant test asserting `fee == amount * feeRateBps / 10_000` across the full input range. This class of bug is exactly what fuzzing catches, and its absence is why it shipped.

**W4. Audit the diff before deploying.** Run the fix through the audit skill (`https://ethskills.com/audit/SKILL.md`), with fresh eyes on every other place decimals are used in the contract — fee math is rarely the only place a wrong-decimals assumption appears. Check reward accrual, share/asset conversion, and any min/max thresholds.

**W5. Deploy V2 to Base and verify immediately.**
- `yarn deploy --network base`
- `yarn verify --network base` in the same session, not later
- Test on mainnet with a small real position ($1–10): stake, early-withdraw, confirm the fee matches expectation onchain.

**W6. Migration + refunds.** This is the heavy part the PM is right to flag; plan it explicitly rather than discovering it during the deploy.
- Decide the migration shape: (a) users withdraw from V1 and re-stake in V2 themselves, or (b) a migration contract/function that moves positions. (a) is simpler and safer; (b) is better UX. With ~$40k TVL and a modest staker count, (a) is likely the right call — fewer new lines of unaudited code touching user funds.
- Build the migration path into the UI: detect a V1 position, show a guided "withdraw from V1 → approve → stake in V2" flow using the mandatory three-button pattern (switch network → approve exact amount → execute). Never show approve and execute at once, never use infinite approvals.
- Execute refunds from the T3 list — direct transfers to affected addresses, with the tx hashes posted publicly.
- Waive or zero the early-withdrawal fee on V1 during the migration window so nobody pays to escape our bug.

**W7. Cut over the frontend.** Point `deployedContracts.ts` at V2 (via `yarn deploy`, don't hand-edit it), remove the 100 USDC UI minimum and the incident banner, keep the V1 migration prompt until positions are drained. Re-run production QA (`https://ethskills.com/qa/SKILL.md`) and redeploy the frontend.

**W8. Sunset V1.** Once positions are migrated, pause V1 deposits permanently and leave withdrawals open indefinitely for stragglers. Publish the V2 address everywhere the V1 address appears.

---

## Order of operations, condensed

| When | Step |
|---|---|
| Today | T1 UI minimum + honest banner |
| Today | T2 evaluate contract pause on early withdrawals |
| Today | T3 quantify overcharges from event history → refund list |
| Today | T4 public disclosure |
| Day 1–2 | W1 failing test on Base fork |
| Day 1–2 | W2 fix decimals scaling at the root |
| Day 2–3 | W3 regression + fuzz tests |
| Day 3 | W4 audit the diff, sweep for other decimals assumptions |
| Day 3–4 | W5 deploy V2 to Base + verify immediately + $1–10 live test |
| Day 4–6 | W6 migration flow + execute refunds |
| Day 6 | W7 frontend cutover, remove the UI minimum, QA, redeploy |
| Day 7+ | W8 sunset V1 |

## What "resolved" means

The incident is closed when: the corrected fee math is live and verified on Base, every affected address has been refunded with public tx hashes, the UI minimum has been *removed* (its presence is the marker that the workaround is still load-bearing), and a fuzz test in CI makes this class of bug fail the build next time.
