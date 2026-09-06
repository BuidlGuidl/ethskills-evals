# Unblock contract verification: do it now

Run verification now, from the same checkout/worktree that performed the Base deployment:

```bash
yarn verify --network base
```

For the Foundry Scaffold-ETH 2 setup, that command replays the deployment metadata in `packages/foundry/broadcast/run-latest.json` and submits the deployed contracts' source and compilation settings to the explorer. It is not a new deployment and it does not change the live contracts.

## What must be in place

1. **The original deployment checkout and artifacts.** In particular, `packages/foundry/broadcast/run-latest.json` from the successful `yarn deploy --network base` run must still be present. `yarn verify` uses that file, so a fresh unrelated checkout is not sufficient unless that broadcast directory is restored exactly.
2. **Base RPC access/configuration sufficient for the existing Foundry deploy/verify scripts.** Since the app is already operating against the contracts, this is normally already configured; verification needs to reach Base and the explorer service.
3. **`ETHERSCAN_API_KEY` available to the Foundry package.** This should not be blocked on ops: Scaffold-ETH 2 provides a working value in `packages/foundry/.env.example` and copies it to `.env` during postinstall, so use that provided value now. Replace it later with an organization-owned key if desired. Keep any private replacement key in the ignored `.env`, not in a committed config file.
4. **The deployed source, compiler version, optimizer/EVM settings, and constructor arguments preserved in the broadcast/build artifacts.** Do not rebuild with changed tool versions or settings and expect verification to describe the already-deployed bytecode; run the project command against the recorded deployment instead.

No deployer private key or funded signer is required for this verification step: it submits metadata for contracts that are already onchain.

## Proposed ticket resolution

1. Recover or locate the exact deployment worktree/artifacts if necessary.
2. Ensure `packages/foundry/.env` contains the supplied `ETHERSCAN_API_KEY` (or an ops-owned replacement).
3. Run `yarn verify --network base` immediately.
4. Open the Base explorer pages for every deployed contract and confirm that source code, ABI, compiler settings, and constructor arguments are shown as verified. Record the URLs and command output in the ticket.
5. If it fails, keep the ticket open with the error and fix the actual missing input (usually the broadcast artifact or an altered build configuration), rather than deferring the attempt to launch day.

## Why now, not at launch

Verification belongs immediately after deployment—effectively in the same release step—not in a public-launch checklist weeks later. Until it is verified, users, auditors, and integrators see opaque bytecode, cannot read the contract interface confidently on the explorer, and the team has a harder time diagnosing any live incident. A failed verification has enough possible causes (missing deployment record, changed compiler settings, incorrect explorer/RPC configuration) that it needs room to investigate.

Running it now gives the team time to correct metadata or configuration while the contracts and deployment context are fresh. Waiting until the announcement couples an avoidable infrastructure task to a time-sensitive public release: the app could launch with unverifiable contracts, or the announcement could be delayed while reconstructing a three-week-old deployment. The launch checklist should only **confirm** the already-verified explorer links, alongside the separate go/no-go check that the full user journey works against live Base contracts with a real wallet and a small real-money transaction.
