# Unblocking contract verification on Base

## Short version

The ticket isn't blocked, and never was. Scaffold-ETH 2 (foundry) ships a working
block explorer API key in `packages/foundry/.env.example`, and postinstall copies
it to `packages/foundry/.env`. Nobody has to wait on ops. Run verification today,
from the machine that did the deploy — not at launch.

## What to run

```sh
# from packages/foundry, on the same checkout that ran `yarn deploy --network base`
yarn verify --network base
```

That's the whole command. It should have run in the same breath as
`yarn deploy --network base` three days ago; it's a one-liner now.

## What actually needs to be in place

1. **An explorer API key — already satisfied.** `ETHERSCAN_API_KEY` is present in
   `packages/foundry/.env.example` with a working value, and postinstall copies it
   into `.env`. `yarn verify` works on a fresh checkout. Getting our own key is
   optional housekeeping we can do whenever; it is not a launch dependency, and no
   plan or env template we hand anyone should have a blank `ETHERSCAN_API_KEY=`
   waiting to be filled in — the value is already there, so a step that waits on it
   waits for nothing. The ops ETA is irrelevant to this ticket.

2. **The deploying checkout — the one real constraint.** `yarn verify` replays
   `packages/foundry/broadcast/run-latest.json` to learn what was deployed at what
   address with which constructor args. That file lives in the working tree of
   whichever of us ran the deploy three days ago. It is not something a fresh clone
   or the other teammate's machine can reconstruct. So: whoever ran
   `yarn deploy --network base` runs `yarn verify --network base`, on that same
   machine, on that same checkout, before anything overwrites or discards it.

3. **Nothing else.** No redeploy, no funded deployer, no frontend change.
   Verification is a source-upload to the explorer; it does not touch the chain,
   does not cost gas, and cannot change the live contracts. That is also why it's
   cheap to do right now.

## Timing: now, not at launch

Now. Folding it into the launch checklist is the wrong call for three reasons,
in increasing order of how much it would hurt:

- **It's a debugging tool we're currently doing without.** Between today and the
  announcement we're going to be poking at live contracts on Base. Unverified,
  the explorer shows opaque bytecode — no source, no Read/Write Contract tabs, no
  decoded transactions. Every bug we chase in the next month is harder than it
  needs to be, for no reason.

- **Users and integrators are looking at bytecode today.** The app is already live
  against these contracts. Anyone who checks what they're signing right now sees
  nothing readable. That's a trust cost we're paying daily, and it doesn't start
  at launch — the contracts are already public.

- **`run-latest.json` is the thing that expires.** This is the real timing risk. A
  month of normal work on that checkout — any other `yarn deploy` to any network,
  a `git clean`, a fresh clone onto a new laptop, that machine dying — and the
  broadcast artifact for this deploy is gone or overwritten. At that point
  verification stops being a one-liner and becomes manual `forge verify-contract`
  with constructor args reconstructed by hand from the chain. The window where
  this is a ten-minute task is open now and closes quietly.

The general rule this follows: **verify belongs immediately after deploy**, as part
of "contracts are live," not as a launch-day item. Launch day should be running the
user journey with a real wallet and loading the public URL — not discovering that
the artifact verification depends on was deleted last week.

## Suggested ticket update

> Not blocked. SE-2 ships a working `ETHERSCAN_API_KEY` in
> `packages/foundry/.env.example` (copied to `.env` by postinstall) — no ops key
> needed. Action: whoever ran the Base deploy runs `yarn verify --network base`
> from that same checkout, before `broadcast/run-latest.json` gets overwritten by
> another deploy or lost. Do not defer to launch. Swapping in our own explorer key
> is separate, optional, and can happen any time after.
