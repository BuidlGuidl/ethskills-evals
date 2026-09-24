# Vault Early-Withdrawal Fee Bug — Fix Plan

**Status:** Live on Base mainnet, ~$40k TVL. Early-withdrawal fee computed at the
wrong decimals scale; withdrawals under 100 USDC are overcharged ~10x.

---

## Does the UI minimum resolve the incident?

**No.** Ship it if you want, but ship it as a *warning sign on a broken stair*, not
as the fix. Three reasons:

1. **The frontend is not the access control layer.** The vault is a verified contract
   on a public chain. Anyone can call `withdraw()` from Etherscan, a wallet's contract
   UI, a bot, an aggregator, or a stale tab of our own frontend that never reloads.
   A UI minimum controls *our* form, not *the contract*. The bug stays reachable by
   every other path.

2. **It converts an overcharge into a lockout.** Any staker whose entire position is
   under 100 USDC now cannot withdraw through our app at all. We would be taking a
   "you got charged too much" bug and giving some users a "you can't get your money
   out" bug. That is a worse incident, not a smaller one, and it is the one that gets
   screenshotted.

3. **It does nothing about money already taken.** Users have already been overcharged.
   The fee is collected and gone regardless of what the form does tomorrow. There is a
   remediation obligation here that no frontend change touches.

The relevant rule from our own build process: **a Phase 2 contract bug goes back to
Phase 1** — reproduce locally on a fork, write a regression test, fix the contract,
redeploy. Never hack around a contract bug in the frontend. The redeploy is heavy;
that is an argument for starting it today, not for avoiding it.

**What the UI minimum *is* good for:** buying hours, not weeks, while the real fix is
built and tested. Treat it as a temporary damage cap with an explicit removal date.

---

## Today

1. **Confirm the blast radius (before touching anything).**
   Pull `Withdraw`/fee events since deploy. Produce a list: address, amount withdrawn,
   fee charged, fee that *should* have been charged, delta. Total the deltas. This
   number drives everything below — refund size, disclosure wording, urgency.

2. **Reproduce on a local fork of Base.**
   `yarn fork --network base`, pin to a recent block, replay a real small withdrawal
   against the deployed vault. Confirm the decimals-scale hypothesis exactly — don't
   fix from a reading of the code. Write the failing test now; it becomes the
   regression test.

3. **Ship a frontend mitigation — but the honest version.**
   Not a silent `min=100`. Ship:
   - A visible banner on the withdrawal form: known fee bug affecting withdrawals
     under 100 USDC, fix in progress, affected users will be made whole.
   - A warning (not a hard block) on sub-100 withdrawals showing the *actual* fee that
     will be charged vs. the intended fee, so the user consents with real numbers.
   - Hard-block only if the user's position is ≥100 USDC, so they have a working path.
     Never block a user whose whole balance is under 100 — leave their exit open with
     the warning.

4. **Disclose.** Short post in Discord/X/wherever the users are: what the bug is, who
   is affected, that it is an overcharge and not a loss of principal, that a fixed
   vault ships this week, and that overcharges will be refunded. Getting ahead of this
   is cheap today and expensive on Thursday.

5. **Freeze fee-parameter changes** and make sure nobody "fixes" this by tuning an
   admin fee setter — that masks the bug at one scale and breaks another.

## This week

6. **Fix the contract, with the test first.**
   Correct the decimals handling (fee math in the token's native 6-decimal USDC scale,
   or normalize to 18 explicitly — pick one and assert it). Test at boundaries: 0,
   1 wei-USDC, 0.99, 1, 99.99, 100, 100.01, and a large position. Add an invariant:
   `fee <= amount * maxFeeBps / 10_000` for all amounts. Coverage ≥90% on the fee path.

7. **Audit the diff.** Run the fix through the audit checklist before it leaves local.
   A decimals bug rarely lives alone — check every other place the contract mixes
   scales (share price, reward accrual, any oracle or price math).

8. **Decide the deployment shape.** Two options, pick based on what the vault actually
   is:
   - *If the vault is upgradeable:* upgrade the implementation. No migration, no
     re-approvals. Verify storage layout is unchanged; run the full test suite against
     the upgraded proxy on a fork before touching mainnet.
   - *If it is not upgradeable:* deploy V2 and migrate. Add a migration path that moves
     a staker's position without requiring them to withdraw through the broken fee
     (e.g. an owner-callable or user-callable `migrate()` that transfers principal at
     zero fee), so the migration itself doesn't cost users money. Re-approvals are
     unavoidable; at $40k TVL and three weeks of users this is annoying, not fatal.

9. **Rehearse on the fork.** Full dress rehearsal against forked mainnet state: deploy,
   migrate a real staker's position, withdraw small and large amounts, confirm fees.
   Only after this passes does anything touch mainnet.

10. **Deploy and verify.** `yarn deploy --network base`, then `yarn verify --network base`
    immediately — same session, not later.

11. **Point the frontend at the fixed vault**, remove the sub-100 warning and any
    block, and QA the full journey with a real wallet and small amounts before the
    banner comes down.

12. **Refund the overcharges.** Using the list from step 1, send each affected address
    their delta (from the fee treasury or team funds). Publish the list and the tx
    hashes. This is the step that actually closes the incident with users.

13. **Post-mortem, one page.** Why the decimals mismatch got past tests and past the
    pre-deploy audit — almost certainly because tests were written in 18-decimal units
    against a 6-decimal token. Add a standing rule: every test involving USDC (or any
    non-18-decimal token) asserts against `parseUnits(x, 6)`, never `parseEther(x)`.

---

## Order of operations, compressed

Quantify → reproduce on fork → warn users in UI + publicly (today)
→ fix + regression test + audit → rehearse on fork → deploy + verify
→ repoint frontend → refund → post-mortem (this week)

## What I'd tell the PM

The UI minimum is not "the fast path" — it's the path that *feels* fast because the
work it skips doesn't show up until later. The contract keeps charging the wrong fee
to anyone who doesn't come through our form, we still owe every affected user a
refund, and we've locked small stakers out of their own money in the meantime. The
redeploy is genuinely heavy. It's also the only thing on this list that makes the bug
stop existing. Start it today; ship the honest UI warning in the meantime so nobody
walks into it unaware.
