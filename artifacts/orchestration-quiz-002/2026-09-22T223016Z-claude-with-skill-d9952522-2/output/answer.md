# Vault early-withdrawal fee bug — fix plan

Base mainnet, Scaffold-ETH 2 (foundry), ~$40k TVL, deployed ~3 weeks ago.
Bug: early-withdrawal fee computed at the wrong decimals scale; withdrawals
under 100 USDC are charged ~10x the intended fee.

## Does the UI minimum resolve the incident?

**No.** It is a useful stopgap for the next few hours and nothing more.

- The vault is a public API. The buggy `withdraw` path is reachable from
  Etherscan's write tab, from a script, from a wallet's raw-tx screen, from any
  integrator, and from any other frontend. A guard in our React form binds none
  of them.
- Our frontend is not the only frontend. Once a contract is verified (and ours
  is), the explorer *is* a frontend.
- It doesn't undo anything. Users overcharged over the last three weeks are
  still overcharged; a minimum changes nothing about money already taken.
- It makes one class of user strictly worse off: anyone whose entire position
  is under 100 USDC can no longer withdraw *at all* through our UI. We would be
  converting "overcharged" into "locked out" for exactly the users the bug hit
  hardest, and small positions are likely a large share of the holder count at
  $40k TVL.
- "Avoid a redeploy" is not a thing the UI buys us. It defers the redeploy; the
  migration and re-approval work is the same work, just done later and with
  more angry users.

So: ship the clamp today because it reduces new harm while we work, and say
plainly in the incident channel that it is mitigation, not a fix. A live
contract bug goes back to the start of the loop — reproduce, correct, test,
redeploy, repoint, handle existing state and users. There is no shortcut that
ends before "redeploy."

## Today

1. **Confirm the blast radius before touching anything.** Pull
   `Withdraw`/fee events from the deployed vault since deploy, compute
   `fee_charged - fee_intended` per withdrawal, and get three numbers: how many
   addresses were overcharged, total overcharge in USDC, and the largest single
   overcharge. Every later decision (refund vs. credit, migrate vs. let users
   exit) depends on these. Do this first — it is cheap and it is read-only.
2. **Ship the UI mitigation, labelled honestly.** Add the minimum to the
   withdrawal form *plus* a banner on the vault page stating the bug, that
   direct contract calls under 100 USDC are still affected, and that a fix and
   a remediation are coming. Do not silently clamp — a silent minimum reads as
   a product rule and users will route around it into the bug.
   - Carve-out: if a user's full position is under 100 USDC, do not block them.
     Show the overcharge amount and let them choose, or tell them to wait for
     the fixed vault. Blocking their only exit is worse than the bug.
3. **Reproduce on a fork of Base.** `yarn fork --network base` (that exact
   argument shape — `yarn fork base` and `yarn fork -n=base` silently fork
   Ethereum mainnet, and the fork answers chain id 31337 either way, so verify
   by checking for code at Base's USDC address, not by chain id). Real USDC,
   real 6 decimals, real deployed vault state. Write a failing test that
   withdraws e.g. 50 USDC and asserts the exact intended fee.
4. **Fix the source and keep the test.** Correct the decimals scaling; the test
   from step 3 must fail on the old source and pass on the new one. Add cases
   at the boundaries — 1 USDC, 99.99, 100, 100.01 — and a fuzz test over
   amounts so a future edit can't reintroduce a scale error.
5. **Decide the upgrade path and write it down.** Two cases:
   - **Behind a proxy:** upgrade in place. No migration, no re-approvals,
     addresses unchanged. Confirm this by checking for an EIP-1967 impl slot on
     the live address — if it holds, most of the PM's objection evaporates and
     this can land this week easily.
   - **Not upgradeable:** new vault deploy + migration. Heavier, but it is the
     only correct path; plan it as below.
6. **Pause, if there's a pause.** If the vault has an owner-gated pause or a
   fee-parameter setter that can be set to 0, use it. A fee of 0 on the live
   contract is a better mitigation than any frontend change, because it binds
   direct callers too. Check for this before assuming a redeploy is the only
   lever.

## This week

7. **Full test suite green, then rehearse the deploy on the Base fork.** Run
   the actual deploy script against the fork, then walk the whole user journey
   there — approve, stake, early-withdraw a small amount, confirm the fee is
   right to the cent. Gate: the fork run is clean *and* funded deployer
   confirmed (`yarn account` shows the deployer's real Base ETH balance).
   Frontend stays on localhost through all of this; during fork work
   `targetNetworks` is `chains.foundry`.
8. **Deploy and verify in one breath.** `yarn deploy --network base` then
   `yarn verify --network base` immediately — not as a later checklist item.
   Verify replays `broadcast/run-latest.json`, so run it from the same checkout
   that deployed. No explorer-key errand: `packages/foundry/.env.example` ships
   a working `ETHERSCAN_API_KEY` and postinstall copies it, so nothing here
   waits on getting a key.
9. **Walk the live contracts with a real wallet before the frontend is
   public.** Point a local frontend at the new address on Base, put $1–10 of
   your own money through approve → stake → early withdraw, and check the fee
   on the actual transfer. Gate: every step worked with real money. This is the
   step that catches the decimals class of bug, and it is the step that would
   have caught this one.
10. **Repoint the frontend and ship it.** Update the deployed address and set
    `scaffold.config.ts` `targetNetworks` to Base in the same change — a build
    that flips one without the other reads a chain nobody is on. Remove the
    100 USDC minimum in this same deploy; leave the banner until remediation is
    done. Then load the public URL yourself and put one transaction through it.
    Keep secrets out: `scaffold.config.ts` is committed, so any RPC or Alchemy
    key comes from `process.env` and lives in `.env.local`.
11. **Migrate stakers.** If not upgradeable: keep the old vault readable, let
    users withdraw (fee-disabled if you have that lever), and either offer a
    one-tx migrate helper or accept exit-and-restake with fresh approvals.
    Announce a date after which the old vault is unsupported. Yes, this is the
    heavy part the PM wanted to avoid — it is unavoidable, and doing it a week
    from now is cheaper than doing it a month from now with 3x the TVL.
12. **Remediate the overcharge.** Using the step-1 numbers, refund the delta
    from the treasury. At $40k TVL this is almost certainly a small absolute
    sum and the cheapest trust purchase available. Publish the address list and
    the amounts.
13. **Post-incident.** One short writeup: what broke, how long it was live,
    what users got back. Then the process fix — a fork-and-real-wallet dry run
    is a required gate before any future mainnet deploy, not an optional step.

## Ordering summary

Measure → mitigate (UI + onchain lever if one exists) → reproduce on a Base
fork → fix + regression test → rehearse deploy on fork → deploy + verify →
real-wallet walkthrough on live contracts → repoint frontend and go public →
migrate → refund → writeup.

The UI minimum sits at step 2 of 13. Everything after it is the actual fix.
