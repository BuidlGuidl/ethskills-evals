# Unblock the Verification Ticket

Run verification now, from the same checkout/machine state that performed the Base deploy:

```bash
yarn verify --network base
```

In the Scaffold-ETH 2 Foundry flavor, this is the intended follow-up to:

```bash
yarn deploy --network base
```

What needs to be in place:

- The checkout must still have the Foundry broadcast data from the deploy, especially `broadcast/run-latest.json`, because `yarn verify` replays that deployment metadata.
- The deployed source, compiler settings, constructor args, libraries, and artifacts must match the bytecode that is already on Base.
- The deploy/verify environment should have the normal SE-2 Foundry `.env` setup. This should not be blocked on ops obtaining a block explorer API key: Scaffold-ETH 2's `packages/foundry/.env.example` already includes a working `ETHERSCAN_API_KEY`, and postinstall copies it into `.env` for a fresh checkout. Using your own explorer key later is optional cleanup, not a launch dependency.
- The contracts must already be indexed by the explorer. Three days after deploy, that should be true.

Do not wait until the public announcement next month. Verification belongs immediately after live deployment, so the right timing is now.

The timing matters because the contracts are already live public infrastructure. Until verified, users, reviewers, teammates, and integrators only see opaque bytecode on the explorer. If verification fails, you want to discover that while the deploy context, artifacts, broadcast files, and constructor details are still fresh and available, not during a launch checklist when the team is trying to announce. Waiting also turns a low-risk operational follow-up into a launch-day dependency with no upside.

So the ticket is not blocked on an API key. It is blocked only on someone with the deployment checkout running:

```bash
yarn verify --network base
```

Do it now, confirm the explorer shows verified source for each deployed contract, and remove verification from the launch checklist except as a final "already verified" sanity check.
