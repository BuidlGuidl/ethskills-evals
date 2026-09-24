# Vault early-withdrawal fee decimals bug — fix plan

**Status:** live on Base mainnet, ~$40k TVL, contracts deployed + verified ~3 weeks ago.
**Bug:** early-withdrawal fee computed at the wrong decimals scale; withdrawals under
100 USDC are charged ~10x the intended fee.
**Impact:** no loss of principal beyond the overcharge, but real user funds have already
been taken incorrectly, and the overcharge is ongoing.

---

## Verdict on the PM's proposal: the UI minimum does **not** resolve the incident

Ship it today anyway — it cuts the bleeding rate — but log it as a **mitigation**, not a fix.
Do not close the incident on it. Reasons, in order of how much they matter:

1. **The contract is the source of truth, and it's public and verified.** Anyone can call
   `withdraw()` directly from Basescan's write tab, a wallet's contract-interaction screen,
   a script, or another frontend. Verifying the contract (correctly — we should have) made
   the ABI trivially available. A form validator in our Next.js app constrains exactly one
   of many paths into the function.
2. **It doesn't remediate anyone already hit.** Three weeks of live withdrawals under
   100 USDC have already been overcharged. Those users are owed a refund regardless of what
   the form does tomorrow. "Nobody hits the bug going forward" is not the same as
   "the incident is over."
3. **It makes the UX worse in a way that can look like trapped funds.** A user whose entire
   position is 40 USDC now cannot withdraw at all through our UI. We've converted an
   overcharge into an apparent lockup for the smallest, most nervous stakers — the exact
   cohort already noticing and talking about this.
4. **Stale frontends and caches.** Users on an old tab, an IPFS-pinned build, or a
   third-party integration never see the new validation.
5. **It's a silent constraint hiding a known defect.** If we ship a bare `min=100` with no
   explanation, we're concealing a bug from users who are already suspicious. That is the
   kind of thing that turns a refundable accounting error into a trust incident.

The thing that actually resolves the incident is: **stop charging the wrong fee on-chain,
and pay back what was overcharged.** Everything else is scaffolding around those two.

---

## Today (day 0)

**1. Freeze the harm on-chain, if the contract lets us.** Before touching the frontend,
check the deployed vault for any owner-controlled lever:
   - a `pause()` / `Pausable` guard;
   - a settable fee parameter (`setEarlyWithdrawalFee`, fee recipient, fee bps);
   - a settable lock period (setting it to 0 may make the early-withdrawal path
     unreachable entirely).

   If a fee setter exists, **set the fee to 0** (or to the value that, at the wrong scale,
   produces the intended charge — prefer 0; it's simpler to reason about and errs toward
   the user). This is the real fix-for-today: it closes the bug for *every* caller, not
   just ones using our form. It costs one transaction and no migration. If only `pause()`
   exists, weigh it carefully — pausing withdrawals is a worse look than an overcharge and
   may itself read as an exit-scam signal. Default: don't pause unless there is no fee
   lever and no other option.

   If there is no lever at all, note it in the incident doc and move to step 2; the code
   fix in week 1 becomes the only path.

**2. Quantify the exposure.** Pull `Withdraw`/fee events from the deployment block to now
   on Base. For each withdrawal, compute `charged - intended` at the correct scale. Produce
   a CSV: address, tx hash, block, overcharge in USDC. Expected to be small on a $40k TVL
   vault — which is exactly why refunding is cheap and there is no excuse not to.

**3. Ship the frontend change — but as a warning, not a silent floor.**
   - Add the guard in the withdrawal form in `packages/nextjs`.
   - Show an explicit banner: known fee-calculation bug on small early withdrawals,
     fix in progress, affected users will be refunded, link to the status post.
   - If we zeroed the fee in step 1, **skip the minimum entirely** and just ship the
     banner. The minimum only makes sense while the bad math is still live.
   - Do not block withdrawal of a user's full position. If someone's entire stake is under
     the floor, let them through with an explicit "you will be overcharged ~X USDC, which
     we will refund" confirmation. Never leave a user with no exit.

**4. Communicate.** Short public post (Discord/X/docs banner): what the bug is, the dollar
   scale, that principal was never at risk, that refunds are coming, and the timeline.
   Getting ahead of this while it's a $-small accounting bug is far cheaper than
   responding to someone else's thread about it.

**5. Open the incident doc** and write the postmortem stub now, while details are fresh.

---

## This week

**6. Fix the math in `packages/foundry/contracts`.** The bug is a decimals-scale error —
   USDC is 6 decimals, and the fee math is almost certainly assuming 18 (or mixing a bps
   denominator with a decimals factor). Fix it by making the scale explicit rather than
   implicit: read `decimals()` from the token or store the scaling factor at construction,
   and keep the fee in basis points with a single, named denominator constant.

**7. Test it properly — this is where the week goes, not the deploy.**
   - Unit tests at the boundaries: 0.01, 1, 99.99, 100, 100.01, and a very large withdrawal.
   - A fuzz test asserting `fee == amount * feeBps / 10_000` across the full range.
   - An invariant test that fees never exceed principal and never exceed the cap.
   - A fork test against Base mainnet state replaying the actual overcharging transactions
     and asserting the new code produces the intended fee. This is the test that proves the
     fix, and it's cheap with foundry's `--fork-url`.

**8. Choose the deployment path.** Check first whether the vault is behind a proxy
   (Scaffold-ETH's default deploy scripts are not upgradeable, so assume not unless the
   deploy script says otherwise):
   - **If upgradeable:** upgrade the implementation. Verify storage layout is unchanged.
     Done — no migration, no re-approvals. This is by far the best case.
   - **If immutable (likely):** deploy the corrected vault, and *don't* force a migration.
     With the fee zeroed on the old vault, the old vault is no longer harmful — it's just
     deprecated. Point the frontend at the new vault for new deposits, keep a read-only
     "withdraw from legacy vault" path in the UI, and let stakers migrate on their own
     schedule. The PM is right that a forced migration is heavy; the answer is not to skip
     the fix, it's to not force the migration.
   - If neither a fee lever nor upgradeability exists, the migration is unavoidable —
     because in that case the old vault will keep overcharging every caller forever.

**9. Get a second pair of eyes on the diff** before deploy. It's a small diff in the exact
   arithmetic that just burned us; an internal review plus a security-focused pass on the
   changed function is proportionate. Don't let "it's a one-line decimals fix" skip review —
   that's how the original landed.

**10. Deploy, verify, and regenerate frontend types.**
   - `forge script` deploy to Base, then verify on Basescan immediately (unverified
     contracts in the middle of a trust incident are a bad look).
   - Regenerate `deployedContracts.ts` and point the frontend at the new address.
   - Smoke-test a real small withdrawal on mainnet with our own funds, at 1 USDC, and
     confirm the fee on-chain matches intent.

**11. Refund the affected users** from the CSV in step 2. Prefer a direct push of USDC to
   each affected address over a claim contract — at $40k TVL the list is short, pushing
   costs a few dollars of gas on Base, and a claim flow is another contract to get wrong.
   Publish the list (addresses + amounts + refund tx hashes) so the accounting is checkable.

**12. Remove the UI minimum and the banner** once the new vault is live and refunds are out.
   Replace with a short changelog entry. Close the incident here — not before.

---

## Follow-ups (next sprint, not blocking)

- Add a decimals-aware test helper so no future contract hardcodes 18 against a 6-decimal
  token. This class of bug will recur otherwise — USDC/USDT on every chain are 6 decimals.
- Add a fee sanity check in the contract: revert if the computed fee exceeds a hard cap
  (e.g. some small % of the withdrawal). A bound like that would have turned this from a
  three-week silent overcharge into a revert on day one.
- Ensure future vault deploys ship with a pause and a fee setter from the start. The reason
  day 0 is uncertain above is that we may have no lever at all.
- Monitoring: alert on any fee event exceeding the expected ratio.

---

## Summary for the PM

The UI minimum is worth shipping today and it does reduce the number of people who hit the
bug — but it doesn't end the incident, because the buggy function stays callable by anyone
and the people already overcharged still haven't been paid back. The genuinely fast path is
**zero out the fee on-chain today if the contract has a setter** — one transaction, no
migration, closes the bug for every caller — then ship the corrected contract this week and
refund from event logs. The heavy migration the PM wants to avoid is avoidable: with the fee
zeroed, the old vault is harmless and stakers can migrate at their own pace instead of being
forced. We only get pushed into a forced migration if the deployed contract has no
fee lever and isn't upgradeable, which is the first thing to check this morning.
