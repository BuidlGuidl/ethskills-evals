# Unblocking Base Contract Verification

Run verification now, from the checkout that performed the Base deployment:

```bash
yarn verify --network base
```

For a Scaffold-ETH 2 foundry project, that command replays the latest Foundry deployment broadcast data, so the important prerequisite is not a new deploy and not a launch checklist slot. The important prerequisite is access to the same repo checkout/artifacts that contain the deployment broadcast, especially `packages/foundry/broadcast/run-latest.json`.

What needs to be in place:

- The contracts have already been deployed to Base mainnet with `yarn deploy --network base`.
- The verification command is run from the deployment checkout so it can read the broadcast metadata for the live addresses and constructor arguments.
- The Base network config and RPC environment still work for the repo.
- `ETHERSCAN_API_KEY` is present in `packages/foundry/.env`. In the SE-2 foundry template this is not supposed to block on ops: `packages/foundry/.env.example` already includes a working value, and postinstall copies it into `.env`. A team-owned explorer key can be swapped in later as housekeeping, but it is not a launch dependency.

So the ticket should be changed from blocked to actionable. The exact action is:

```bash
cd <deployment-checkout>
yarn verify --network base
```

Do it now, not right before the public announcement next month.

Timing matters because the contracts are already live on Base mainnet. Until verification is done, everyone sees opaque bytecode on the explorer: users cannot inspect source, integrators cannot confidently build against it, and your own team loses an important debugging and support surface for the live deployment. Waiting until launch also creates a needless release-day risk: if verification fails because of missing broadcast data, stale artifacts, constructor metadata mismatch, or a config issue, you discover that under announcement pressure instead of while the frontend is still quietly operating against the live contracts.

The clean launch sequence is: deploy contracts, immediately verify them, test the app against the live contracts, then later make the public announcement. Verification is part of hardening the already-live contract deployment, not a marketing-launch chore.
