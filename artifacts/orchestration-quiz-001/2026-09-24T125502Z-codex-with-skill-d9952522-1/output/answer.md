# Unblock contract verification

Run verification now, not next month at launch.

The command is:

```bash
yarn verify --network base
```

Run it from the same Scaffold-ETH 2 checkout/environment that performed:

```bash
yarn deploy --network base
```

What needs to be in place:

- The deployed contracts already exist on Base mainnet.
- The checkout still has the Foundry broadcast output from the deploy, especially the latest Base run under `packages/foundry/broadcast/.../run-latest.json`.
- The source, compiler settings, deploy scripts, constructor args, and deployed bytecode still match what was deployed.
- The repo has dependencies installed and can run the SE-2 scripts.
- The normal `packages/foundry/.env` setup exists. This is not blocked on ops providing a new block explorer key: SE-2's foundry `.env.example` already includes a working `ETHERSCAN_API_KEY`, and postinstall copies it into `.env`. Replacing it with a team-owned key later is fine, but it is optional housekeeping, not a launch blocker.
- Network access to Base/BaseScan-style verification endpoints works.

What we do not need:

- A new deploy.
- A funded deployer.
- A private key for sending transactions.
- Waiting until the public announcement.

Timing matters because verification is part of the deploy closure, not a marketing-launch task. Until it is done, the live Base contracts are opaque bytecode on the explorer: users, reviewers, partners, and our own team cannot easily inspect source, constructor arguments, or match the deployed bytecode to the repo. If verification fails, that is exactly the kind of problem we want to discover while the deployment context, commit, artifacts, and broadcast files are still fresh, not weeks later while trying to launch publicly.

So the ticket should be unblocked by running `yarn verify --network base` now from the deploy checkout. If it fails, debug that failure immediately while the deployment artifacts are still available.
