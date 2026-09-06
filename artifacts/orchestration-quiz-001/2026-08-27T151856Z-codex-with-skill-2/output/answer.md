# Unblock contract verification — Base mainnet

Run this **now**, from the same Scaffold-ETH 2 checkout and deployment
workspace that produced the successful Base deployment:

```sh
yarn verify --network base
```

This is a verification step only; do **not** run `yarn deploy` again.
After it completes, open each deployed contract on the Base explorer and
confirm that its source, compiler settings, constructor arguments, and proxy
relationship (if applicable) are shown correctly. Record the explorer links
and the command result on the ticket.

## What must be in place

1. The original deployment checkout, with its deployment broadcast record.
   `yarn verify` replays `broadcast/run-latest.json`, which contains the
   deployment transactions and inputs it needs. Use the exact checkout (or a
   preserved copy of it) that performed the deploy. If that file is missing,
   recover it from the teammate/CI workspace or deployment artifact; do not
   redeploy merely to make verification possible.
2. The matching source tree and Foundry build configuration used for the live
   deployment (including compiler version, optimizer, remappings, libraries,
   and constructor inputs represented by the broadcast). Verification compares
   a rebuilt artifact with the already-deployed bytecode, so a later source or
   configuration change can prevent a match.
3. Dependencies installed and the Foundry environment configured for Base,
   including its RPC setting as normally required by the project.
4. An `ETHERSCAN_API_KEY` in `packages/foundry/.env`. This is **not** blocked
   on ops: Scaffold-ETH 2's `packages/foundry/.env.example` includes a working
   key and postinstall copies it to `.env` on a fresh checkout. Use that to
   unblock the run now; replace it with an ops-managed key later if policy or
   rate limits call for it. Keep private keys and replacement keys out of
   committed config.

## Timing decision

Verify now, immediately after discovering the omission; do not fold it into
the public-launch checklist next month. The intended sequence is deploy,
then `yarn verify --network base`, then launch work—not one combined event.

The timing matters because verification is the public proof that the source
users and integrators inspect corresponds to the immutable Base bytecode.
Until then, the contracts are opaque on the explorer and the team is debugging
and supporting a live system without readable verified source. Doing it while
the deployment checkout, broadcast file, exact compiler settings, and context
are still fresh gives the highest chance of a clean deterministic match and
makes any mismatch a small, isolated incident.

Waiting until launch creates an unnecessary critical-path dependency on an
explorer/API service and on recovering old deployment artifacts. A failure at
that point either delays the announcement or pressures the team to announce
with unverified contracts. Finish verification now, resolve any mismatch now,
and make the launch checklist a simple confirmation that the recorded explorer
links remain valid—not the first verification attempt.
