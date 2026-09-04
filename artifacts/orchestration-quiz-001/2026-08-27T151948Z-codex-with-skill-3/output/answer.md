# Unblock contract verification — Base mainnet

Verify now, from the same repository checkout that performed the successful
Base deployment:

```sh
yarn verify --network base
```

For the Foundry flavor of Scaffold-ETH 2, this command uses the deployment
artifacts in `packages/foundry/broadcast/run-latest.json` to replay and verify
the contracts on the Base explorer.  Therefore, the required inputs are:

- the exact checkout/worktree that ran `yarn deploy --network base`, with its
  `packages/foundry/broadcast/run-latest.json` still present;
- the source code and compiler/dependency configuration corresponding to the
  deployed bytecode (do not verify from a later, changed revision);
- normal network/RPC access for the verification command; and
- `ETHERSCAN_API_KEY` available to the Foundry package environment (normally
  in `packages/foundry/.env`).

The API-key ticket should not remain blocked on Ops. Scaffold-ETH 2 supplies a
working `ETHERSCAN_API_KEY` in `packages/foundry/.env.example` and copies it
to `.env` during postinstall, so a fresh standard checkout can verify without
waiting for a separately issued explorer key. A team-owned key may be
substituted later for ownership, quota, and audit purposes, but it is not a
prerequisite for completing this verification.

Run verification now, not as part of the public-announcement checklist next
month. It belongs immediately after deployment: the deployed source becomes
readable and trusted by users and integrators, and the team can diagnose any
verification mismatch while the deployment commit, constructor arguments, and
broadcast record are fresh and recoverable. Waiting makes verification more
fragile—later source or configuration changes can stop matching the live
bytecode, and the original broadcast record may be lost—while leaving live
users and debuggers with opaque bytecode for weeks.

Launch still has its own separate go/no-go checks: before the public frontend
is reachable, walk the complete live-contract user journey with a real wallet
and a small real-money transaction; after frontend deployment, load the public
URL yourself and submit one transaction. Verification is already overdue, not
a reason to defer those launch checks or merge them into one last-minute step.
