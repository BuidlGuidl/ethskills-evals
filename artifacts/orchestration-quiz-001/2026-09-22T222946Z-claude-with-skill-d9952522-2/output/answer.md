# Unblocking contract verification on Base

## Short version

The ticket is not actually blocked, and it should not wait for launch. Scaffold-ETH 2
ships a working `ETHERSCAN_API_KEY` in `packages/foundry/.env.example`, and postinstall
copies that file to `packages/foundry/.env`. So `yarn verify` works on a fresh checkout
with no key from ops. The "waiting on a block explorer API key (ETA next sprint)"
blocker is waiting for nothing — drop it.

Run verification today, from the machine/checkout that did the deploy.

## What to run

```bash
# from the repo root of the checkout that ran `yarn deploy --network base`
yarn verify --network base
```

That's the whole command. It replays the recorded deploy broadcast and submits the
source + constructor args to the explorer.

## What actually needs to be in place

1. **`packages/foundry/.env` exists and has `ETHERSCAN_API_KEY` set.**
   It should already, from postinstall copying `.env.example`. Confirm the value is
   non-empty. If someone "helpfully" blanked it out to wait on the ops key, restore it
   from `.env.example`. Never hand anyone an env template with a blank
   `ETHERSCAN_API_KEY=` to fill in — the working value is already there.

2. **You are in the checkout that performed the deploy.** This is the one real
   constraint. `yarn verify` replays `packages/foundry/broadcast/run-latest.json` — the
   artifact written by the deploy run three days ago. Run it anywhere else and there is
   nothing to replay, or worse, a *different* run's broadcast gets replayed.

   Practical consequences for a two-person team:
   - Whoever ran `yarn deploy --network base` runs `yarn verify --network base`, on the
     same machine, from the same clone.
   - Do not run any other deploy (including to a local chain or fork) from that checkout
     for the same script before verifying — it overwrites `run-latest.json`.
   - The source in that working tree must still be exactly what was deployed. Same
     commit, same compiler settings, no post-deploy edits to the contracts. If the tree
     has drifted, check out the deploy commit first.

3. **Nothing else.** No ops ticket, no new account, no funded deployer (verification
   sends no transaction and costs no gas).

Swapping the shared key for your own org's explorer key is optional housekeeping you
can do afterwards. It is not a launch dependency and should not gate this ticket.

## Now, not at launch

Do it now. Verification belongs in the same breath as the deploy, not folded into the
launch checklist a month out. Reasons, in order of how much they'd hurt:

- **Right now the contracts are live and unverified.** The app already works against
  them, which means anyone who finds the address — users, integrators, a security
  researcher, a curious holder — sees opaque bytecode. No Read/Write Contract tab, no
  source, no way to independently check what they're approving. That's a trust cost
  accruing every day between now and launch, and "launched three days ago but no source"
  reads worse than it is.

- **You are currently debugging a live contract without source on the explorer.** If
  something misbehaves on Base this month, verified source is the difference between
  reading a decoded transaction on the explorer in a minute and reverse-engineering
  calldata. That's exactly the window where you most want it.

- **The one thing verification depends on is perishable.** `run-latest.json` is a local
  file in one person's checkout. Over a month it can be clobbered by the next local
  deploy, lost to a machine reset, or stranded when the branch moves on. The longer you
  wait, the more likely the cheap path is gone and you're reconstructing constructor
  args and compiler settings by hand.

- **Bundling it into the launch checklist puts an unrehearsed step on the critical
  path.** Launch day is for steps you've already proven. If verification throws a
  compiler-version or constructor-args mismatch, you want that on a Tuesday with a month
  of slack, not an hour before the announcement while you're also flipping
  `targetNetworks` and deploying the frontend.

- **It is minutes of work with no gas cost and no user-visible risk.** There is no
  upside to batching it. The "all in one go" saving is a single command.

## Suggested ticket update

> Not blocked. SE-2 ships a working `ETHERSCAN_API_KEY` in
> `packages/foundry/.env.example`, copied to `.env` by postinstall — no ops key needed.
> Action: `<whoever deployed>` runs `yarn verify --network base` from the checkout that
> ran the Base deploy (verify replays `broadcast/run-latest.json`, so it must be that
> clone, at the deploy commit, with no intervening deploy). Doing this now rather than
> at launch: contracts are live and unverified today, and `run-latest.json` gets more
> fragile the longer we wait. Optional follow-up: swap in our own explorer key.

## While you're here

Verification is the tail of the deploy step, so the rest of the launch sequence is
unaffected — but two adjacent gates are worth confirming before the announcement:

- The frontend still points where you intend: `scaffold.config.ts` `targetNetworks`
  should name Base, and it gets changed in the same step that repoints the frontend at
  the deployed addresses. (Sounds like this already happened, since the app works
  against live contracts.)
- Before the frontend is publicly reachable, walk the full user journey against the live
  Base contracts with a real wallet and $1-10 of real money, and after the frontend
  deploy, load the public URL yourself and put one transaction through it.
