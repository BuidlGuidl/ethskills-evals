# Early-withdrawal fee decimals bug — fix plan

**Status:** vault live on Base mainnet, ~$40k TVL, verified 3 weeks ago. Early-withdrawal fee is computed at the wrong decimals scale; withdrawals under 100 USDC are overcharged ~10x. No loss of principal beyond the overcharge.

## The short answer on the UI minimum

**A 100 USDC minimum in the withdrawal form does not resolve this incident.** Ship it today as a bleed-stop, but do not close the incident on it.

Why not:

- The vault is a **public API**. The buggy `withdraw` path is reachable from Etherscan's write tab, from a raw `cast send`, from any wallet's contract-interaction screen, from an integrator, and from any frontend that isn't ours. A guard in our React form binds none of them.
- The deployed bytecode still overcharges. Every user who has already withdrawn under 100 USDC is still owed money — a UI change is not restitution.
- It makes the product worse in a visible way: we'd be telling a user with 40 USDC staked that they cannot withdraw at all. That is a strictly worse user-facing outcome than the overcharge, and it converts a fee bug into a funds-stuck complaint.
- "Avoid a redeploy" is not actually avoided — it's deferred. The bug is in the source; the source has to be corrected and the corrected code has to reach the chain either way. The migration cost the PM is worried about is the same cost next week, plus more accrued overcharges and more comms debt.

So: UI clamp = hours of breathing room. The fix is the full loop back to the contract.

## Today

1. **Ship the UI mitigation.** In the withdrawal form, block amounts in the overcharge range and show the real reason: "Withdrawals under 100 USDC are temporarily disabled — we found a fee calculation bug and are shipping a corrected contract this week. Affected withdrawals will be refunded." Frontend-only ticket: no chain stood up, no redeploy, no regeneration of `deployedContracts.ts`.
2. **Post the disclosure** (status page / Discord / X, wherever our users actually are), before someone else writes it for us. Say what's wrong, the ~10x scope, that principal is safe, that refunds are coming, and when the fixed contract lands.
3. **Pull the overcharge ledger.** Index `Withdraw`/fee events from the deploy block to now, compute intended-vs-charged per withdrawal, and get a concrete address→amount refund list with a total. We need this number today because it sizes the remediation and it's the first thing users will ask for.
4. **Reproduce locally and write the failing test.** `yarn fork --network base` (note the two-token form — `yarn fork base` and `yarn fork --network=base` silently fork Ethereum mainnet; confirm the fork by checking for code at Base's USDC address, since the fork answers chain id 31337 regardless). Fork gives us real USDC rather than a mock, so the decimals bug reproduces for real. Write the regression test that **fails against current source** at, say, 25 USDC, and pin the expected fee in raw units.
5. **Answer the one question that decides this week's shape: is the vault behind a proxy?** If yes, the fix is an implementation upgrade — no migration, no re-approvals, and the PM's objection evaporates. If no, it's a new deployment plus migration. Check the deployed address for a proxy pattern before planning further.

## This week

6. **Correct the source** so the fee math is in the token's raw units end to end. While in there, grep every other place the fee scale or a hardcoded `1e18` touches a 6-decimal token — a decimals bug is rarely alone. Tests go green, full suite passes.
7. **Rehearse the whole thing against the Base fork.** Deploy the corrected vault (or the upgrade) to the fork, run the fee assertions across the range that was broken, and if this is a migration, rehearse the migration script on forked live state — real balances, real stakers, real gas. This is the step that gets skipped and the step that catches everything.
8. **Go/no-go before touching mainnet:** tests pass, deploy/upgrade script runs clean on the fork, migration rehearsed on forked state, deployer funded with real ETH on Base (`yarn account` to confirm the balance — fund it before the deploy, not after it fails).
9. **Ship to Base.**
   - *Proxy path:* execute the upgrade, then immediately confirm the fee at a small amount with a real on-chain call.
   - *Fresh deploy path:* `yarn deploy --network base`, then **`yarn verify --network base` in the same breath** — from the same checkout, since verify replays `broadcast/run-latest.json`. No explorer key errand: `packages/foundry/.env.example` already ships a working `ETHERSCAN_API_KEY` and postinstall copies it. Then pause the old vault's deposits so TVL stops splitting.
10. **Repoint the frontend** at the new address in the same step (only needed if the address moved), and drop the UI minimum in that same release — not before the contract is live, or we re-open the bug.
11. **Migrate stakers** (fresh-deploy path only). Sponsor the gas if we can; users did not cause this. New approvals are unavoidable here, which is exactly why step 5 matters.
12. **Pay the refunds** from the step-3 ledger — one batch transaction, then publish the tx hash and the per-address amounts alongside the disclosure.
13. **Walk the live journey yourself** with a real wallet and $1–10 of your own money: stake, early-withdraw below 100 USDC, confirm the fee charged matches the intended fee to the raw unit. Then load the public URL and put one transaction through it. The incident closes here, not at step 1.

## What I'd tell the PM

The fastest path to "users stop getting overcharged" is not the UI clamp — the clamp only stops *our* form from being the one that does it, while blocking small withdrawals entirely. It buys a day. Step 5 is the real lever on the cost he's worried about: if we're behind a proxy, there's no migration and no re-approvals at all.
