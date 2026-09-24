# Vault early-withdrawal fee decimals bug — incident fix plan

**Status:** confirmed bug in production. Base mainnet, ~$40k TVL, contracts deployed+verified ~3 weeks ago (Scaffold-ETH 2, foundry).
**Symptom:** early-withdrawal fee computed at the wrong decimals scale; withdrawals under 100 USDC are charged ~10x the intended fee.
**Impact:** users are overcharged. No loss of principal beyond the overcharge, no path to drain the vault. Trust damage is the real cost, and it is compounding while the bug is live.

---

## The headline answer: does the UI minimum resolve the incident?

**No.** It reduces the rate at which new users hit the bug. It does not fix it, and it should not be the only thing we ship.

Why not:

1. **The frontend is not a security boundary.** The vault is a verified contract on Base. Anyone can call `withdraw` directly from Etherscan/Basescan, a wallet's contract-interaction screen, a script, an aggregator, or a competing frontend. A minimum enforced in React is a suggestion, not a constraint. The class of user most likely to bypass the UI — the one poking at the verified contract — is also the one most likely to notice the overcharge and post about it.
2. **It makes the bug worse for the people it "protects."** A user with 40 USDC staked who wants out now cannot use our UI at all. Their options become: leave funds stuck, or go around us and eat the 10x fee. We have converted an overcharge into a partial lockout plus an overcharge.
3. **It does nothing for users already overcharged.** Every wrong fee already taken is still wrong. The incident is not closed until those users are made whole.
4. **It hides the signal.** With the UI blocking small withdrawals, our own analytics stop showing the problem while it continues on-chain. We would be measuring our patch, not our bug.
5. **The stated reason to avoid a redeploy is a real cost, but it is not the only on-chain option.** Migration + re-approvals is heavy — agreed. But before concluding "redeploy or nothing," we need to check whether the deployed contract already has an admin lever (fee setter, pause, guardian role) that neutralizes the bug with a single transaction and zero migration. That check is step 1 below and it is cheap.

**What actually resolves the incident:** the wrong fee stops being charged on-chain, and everyone overcharged is refunded. The UI minimum is a bandaid we ship alongside that, clearly labeled, and remove as soon as the on-chain fix lands.

---

## What we ship today

Goal: stop the bleeding on-chain if we can, communicate honestly either way, and freeze the blast radius.

### 1. Confirm the exact bug and its true blast radius (1–2 hours, blocking everything else)
Do this before any mitigation, so we fix the right thing once.
- Write a foundry fork test against Base mainnet at current block that reproduces the overcharge. Assert actual fee vs intended fee across a sweep of amounts: 1, 10, 50, 99, 100, 101, 1_000, 10_000 USDC.
- Establish precisely where the wrong scale kicks in. "Under 100 USDC" is our current read; confirm whether it is a hard threshold, whether amounts *over* 100 are also slightly wrong, and whether the same scale error appears anywhere else in the contract (reward accrual, any other fee path, any comparison against a hardcoded constant). A decimals mistake is rarely load-bearing in exactly one line — grep every literal and every place USDC amounts meet an 18-decimal assumption.
- Output: a one-paragraph written statement of the bug and an exact formula for `overcharge(amount)`. Everything downstream (refunds, comms, the fix) depends on this being right.

### 2. Quantify who was affected (parallel with step 1, ~1 hour)
- Pull all withdrawal events from deployment to now via RPC/subgraph.
- For each, compute intended fee vs charged fee using the formula from step 1.
- Produce a CSV: address, tx hash, block, amount, fee charged, fee intended, overcharge. Sum it.
- At $40k TVL over three weeks this is likely a small number of addresses and a small dollar total. Knowing the exact number turns "we have a problem" into "we owe 14 users $312 total," which makes every remaining decision easy and makes the comms honest.

### 3. Neutralize on-chain if a lever exists (today, if available)
Check the deployed contract for, in order of preference:
- **A fee setter / fee-BPS parameter under owner or timelock control** → set the early-withdrawal fee to 0. The bug is a wrong multiplier on a fee; a zero fee cannot be miscomputed. We forgo fee revenue for a few days. At this TVL that is rounding error against the trust cost. **This is the best outcome: incident neutralized today, no migration, no re-approvals.**
- **A pause / guardian function on withdrawals** → weigh carefully. Pausing stops the overcharge but also stops users getting their money out, which reads far worse than an overcharge and is a genuine escalation. Only use this if there is no fee setter *and* we have found something worse than an overcharge. Default: do not pause.
- **Neither** → we are on the V2 path (this week). The UI minimum plus loud disclosure is our only same-day mitigation, and we own that it is partial.

Whatever lever we use, confirm the admin key's custody and signing path *now* (who holds it, is it a multisig, what's the threshold, is a quorum reachable today). Discovering the key is on a laptop in another timezone during the fix is the classic way a one-hour mitigation becomes a two-day one.

### 4. Ship the frontend changes — but not the PM's version
Ship today, in the same deploy:
- **A visible banner on the withdrawal form and the dashboard**, not a silent block: "Known issue: early-withdrawal fees on amounts under 100 USDC are currently calculated incorrectly and are higher than intended. We are fixing this and will refund every affected withdrawal. [link to status post]"
- **Accurate fee preview.** Show the fee the contract will *actually* charge, computed with the buggy formula, next to the intended fee. Never show a number the contract will not honor. If our UI today quotes the intended fee and the contract takes 10x, that is the part that looks like dishonesty rather than a bug.
- **A soft minimum, not a hard one.** Default the form to a 100 USDC minimum with the warning, but let a user who understands the overcharge proceed anyway. Some users need their 40 USDC today and it is not ours to withhold. Hard-blocking is the thing to push back on with the PM.
- **Do not claim the issue is resolved.** The banner stays until the on-chain fix ships.

### 5. Communicate (today, once step 2 gives us numbers)
- Short status post / Discord+Twitter announcement: what the bug is, that it is an overcharge and principal is safe, the exact remediation, and the refund commitment with a date.
- Direct outreach where we can (on-chain message or existing channel) to the affected addresses from the step-2 CSV.
- Getting ahead of this is most of the value. Users are already noticing; the difference between "they told us" and "we found out" is the whole reputational outcome.

---

## What we ship this week

### 6. Fix the contract properly
- Correct the decimals handling at the source. Do not special-case the sub-100 range or clamp the output — fix the scale so the fee formula is correct for all amounts by construction. Patching the symptom range leaves the same landmine for the next token we list or the next threshold we add.
- Make the token's decimals explicit rather than assumed: read `decimals()` at construction or store the scale factor, and write the fee math so an 18-decimal token and a 6-decimal token both work.
- Add unit tests covering the fee at every magnitude, plus a property/fuzz test asserting `fee(amount) == amount * feeBps / 10_000` across the full input range. This bug class is exactly what fuzzing catches for free.
- Add a fork test reproducing the production bug and proving the new contract does not have it.

### 7. Deploy V2 and migrate
Acknowledging the PM's point — migration is genuinely the expensive part, which is why it is this week's work and not today's:
- Deploy the corrected vault to Base, verify it.
- **Path A (preferred, if the deployed contract supports it):** if there is any admin-controlled upgrade or a migration hook, use it — no user action required.
- **Path B:** run both vaults in parallel. New deposits route to V2. V1 stays open for withdrawals with the fee set to 0 (from step 3). Add a one-click "migrate my stake" flow in the UI that withdraws from V1 and deposits to V2, batched where possible to minimize approvals and gas. Do not force users to migrate; let V1 drain naturally.
- Be honest in the UI about which vault a user's funds are in and what, if anything, they need to do.
- Cover migration gas for users if the total is small — at $40k TVL it probably is, and it removes the main objection to migrating.

### 8. Refund every overcharge
- Using the step-2 CSV, refund the exact overcharge amount to each affected address. A direct transfer is simplest at this scale; a claimable Merkle distributor is only worth it if the address count is large.
- Round refunds up, not down. The rounding is cheap and the goodwill is not.
- Publish the refund tx hashes alongside the CSV so the accounting is verifiable.
- Re-run the event scan after the on-chain fix to catch anyone overcharged between today and the fix landing.

### 9. Close out
- Remove the UI minimum and the banner once V2 is live and V1's fee is zeroed.
- Short public post-mortem: what happened, why, what we changed. Cheap to write, disproportionately valuable for a young protocol.
- Add the fuzz test for fee math to CI so this cannot regress.
- Audit the rest of the codebase for the same decimals assumption — one wrong-scale bug usually has siblings.

---

## Ordered checklist

| # | Step | When | Blocking? |
|---|------|------|-----------|
| 1 | Fork test reproducing bug; exact overcharge formula; grep for sibling decimals bugs | Today, first | Blocks 2, 6 |
| 2 | Event scan → affected-address CSV + total overcharge | Today, parallel | Blocks 5, 8 |
| 3 | Confirm admin key custody; set V1 early-withdrawal fee to 0 if a setter exists | Today | — |
| 4 | Frontend: banner + accurate fee preview + soft (not hard) minimum | Today | — |
| 5 | Public disclosure + direct outreach to affected users | Today, after 2 | — |
| 6 | Corrected contract + unit/fuzz/fork tests | This week | Blocks 7 |
| 7 | Deploy + verify V2; migration path (upgrade hook, or parallel vaults + one-click migrate) | This week | Blocks 9 |
| 8 | Refund all overcharges; publish tx hashes; re-scan for late cases | This week | — |
| 9 | Remove UI minimum + banner; post-mortem; fuzz test in CI; audit for sibling bugs | This week | — |

---

## Where to push back on the PM, concretely

The PM is right that migration is expensive and right that speed matters. They are wrong that the UI minimum lets us skip the on-chain fix.

- "Nobody hits the bug" is false — the contract is public and verified, and the UI is one of several ways to reach it.
- A hard UI minimum locks small stakers out of their own funds, which is a worse user-facing story than the overcharge it prevents.
- It leaves already-overcharged users unrefunded, so the incident stays open regardless.
- Step 3 may well give us the speed the PM wants *without* a migration: if a fee setter exists, one transaction today neutralizes the bug with no redeploy and no re-approvals. Check this before accepting "redeploy or nothing" as the framing.

Ship the UI change today — as a warning and a soft default, alongside honest disclosure — and ship the on-chain fix and refunds this week.
