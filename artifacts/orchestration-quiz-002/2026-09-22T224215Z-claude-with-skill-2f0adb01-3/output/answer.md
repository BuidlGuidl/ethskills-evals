# Vault Early-Withdrawal Fee Bug — Fix Plan

**Incident:** Early-withdrawal fee is computed at the wrong decimals scale. Withdrawals under 100 USDC are charged ~10x the intended fee. Live on Base mainnet, ~$40k TVL, contracts deployed and verified ~3 weeks ago (2026-09-01-ish).

---

## Bottom line: does the UI minimum resolve the incident?

**No.** Ship it today if you like — as a stopgap — but it is not the fix, and we should not describe it internally or externally as one.

Three reasons:

1. **The bug is in the contract, and the contract is the public interface.** Our React form is one client of a permissionless contract. Anyone can call `withdraw()` directly from Etherscan (we verified the contract — the write tab is right there), from a wallet's raw-tx UI, from a bot, or from a competing frontend. A minimum enforced in the UI is enforced for exactly the users who use our UI and no one else. The overcharge path stays open.

2. **It doesn't undo the overcharges already taken.** Users have been overcharged for up to three weeks. They're noticing. Blocking *future* small withdrawals does nothing for money already taken, and "we added a form validation" is not an answer to "you took 10x my fee."

3. **It makes the product worse in a way users will feel.** A 100 USDC withdrawal minimum on a staking vault means anyone with a position under 100 USDC cannot get their money out through our app at all. We would be converting an overcharge bug into a partial lockout, and doing it silently. That's a worse incident, not a smaller one.

The build system we're working in is explicit about this: **a Phase 2 contract bug goes back to Phase 1** — reproduce locally on a fork, write a regression test, fix, redeploy. **Never hack around bugs in production.** A UI-side minimum is the definition of hacking around it.

The PM's cost concern is real and I'm not dismissing it — migrating stakers and re-doing approvals *is* heavy. That's a reason to plan the migration carefully, not a reason to leave a live overcharge in place. See "Reducing migration pain" below; the cost is likely lower than feared.

---

## What we ship today

Goal: stop the bleeding and be honest about it. No contract changes today.

1. **Pause new deposits** (if the vault has a pause/guardian function). Don't grow exposure to a contract we know is broken. **Do not pause withdrawals** — never trap user funds over a fee bug.
2. **In-app warning banner on the withdrawal form.** Plain language: early withdrawals under 100 USDC are currently being overcharged, we've identified the cause, a fix is landing this week, and *everyone overcharged will be refunded in full*. Do not block the withdrawal.
3. **Soft-discourage, don't hard-block.** If the PM wants something in the form, make it a warning on sub-100 USDC amounts with an explicit "withdraw anyway" path. Users who need their money get their money. Nobody gets surprised.
4. **Public disclosure** — Discord/X/wherever the community is. Same content as the banner. We get ahead of it; users are already noticing, and finding out from each other instead of from us is how trust goes.
5. **Start the refund accounting.** Pull `Withdraw` events from deploy block to now, compute `actual_fee - intended_fee` per withdrawal, produce an address → owed-amount table. Do this today so the number is known before anyone asks.
6. **Freeze the deploy pipeline** on the broken contract. No further deploys of the current vault.

## What we ship this week

7. **Reproduce on a local fork of Base.** `yarn fork --network base`, point at the live vault, write a test that withdraws 50 USDC and asserts the fee is 10x intended. The test must fail against current code before we touch anything.
8. **Fix the decimals scale in the contract.** Audit *every* fee/amount math path while we're in there, not just the one users reported — a decimals error in one place usually means a shared assumption is wrong. Check for other USDC-6-decimals-vs-18 mixups.
9. **Regression tests + full suite.** Keep the failing test from step 7 (now passing). Add boundary cases: 0, 1 wei, just under/over the fee tier thresholds, the exact 100 USDC line, max position. Target ≥90% coverage on the fee logic specifically.
10. **Re-audit the fixed contract** before it goes anywhere near mainnet. Fetch `audit/SKILL.md` and run it. A rushed patch to a live money contract is exactly where the second bug gets introduced.
11. **Deploy the fixed vault to Base + verify immediately** (`yarn deploy --network base` → `yarn verify --network base`, right after, not later).
12. **Test against the live fixed contract with real money, small amounts.** $1–10, real wallet, from the local UI pointed at mainnet contracts (Phase 2). Withdraw a sub-100 USDC position and confirm the fee is correct onchain.
13. **Migrate.** Point the frontend at the new vault address. Three-button flow for the migration path: Switch Network → Approve → Migrate, one button visible at a time. Keep the old vault's withdraw path reachable so anyone who doesn't migrate can still exit.
14. **Execute refunds.** Pay out the table from step 6 — either direct transfer or a claim contract. Announce it when it's done, with numbers.
15. **Remove the warning banner and any UI minimum** once migration is live. Ship the frontend (`yarn ipfs` / `yarn vercel`) and run production QA — burner wallet off, no console errors, mobile, wallet matrix.
16. **Post-mortem.** The real question isn't "how did we get decimals wrong," it's "how did a fee-math error reach mainnet with $40k behind it." Likely answer: no test asserted an exact fee value at a realistic USDC amount. Add that class of test as a pre-deploy gate.

---

## Reducing migration pain

Worth checking before assuming migration is heavy:

- **Is the vault upgradeable?** If there's a proxy, this is a single implementation swap — no migration, no re-approvals. Check first; it changes the whole plan.
- **Is the fee parameterized?** If the scale factor is a settable variable rather than a constant, an owner call may correct it without a redeploy. Verify against the actual math — a scale bug is usually structural, but it's a cheap thing to rule out.
- **If a genuine redeploy is needed,** a migration helper that pulls from the old vault and deposits to the new one in one transaction collapses the user-facing cost to a single approve + single click. That's the difference between "heavy" and "an afternoon."

Even at the worst case — full redeploy, every staker re-approves — that's the correct cost. We are running a live contract that overcharges people. The bill for fixing that is the bill.

---

## Sequencing summary

| When | What |
|---|---|
| Today | Pause deposits · warning banner (not a block) · public disclosure · build refund table · freeze deploys |
| Day 1–2 | Fork repro + failing test · fix decimals · full regression suite |
| Day 2–3 | Re-audit · deploy to Base · verify · live small-amount testing |
| Day 3–5 | Migration path live · refunds paid · banner removed · frontend shipped · post-mortem |

**Ship the UI change today only as a warning, never as a block, and only alongside the contract fix already in motion.** On its own it hides the bug from our users without removing it from our contract.
