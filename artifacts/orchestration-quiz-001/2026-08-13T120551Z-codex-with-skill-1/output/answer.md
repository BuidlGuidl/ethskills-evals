# Contract-verification ticket: unblocked

Run this from the Scaffold-ETH 2 repository (with the same project sources
and Foundry configuration used for the deployment):

```sh
yarn verify --network base
```

For this Foundry-flavor Scaffold-ETH 2 project, that is the intended
verification step after `yarn deploy --network base`. It discovers the
deployment information/artifacts produced by the Scaffold deployment workflow
and submits the contract source and build metadata to the Base block explorer's
verification service.

## What has to be in place

- The repo revision containing the *exact* Solidity sources used to deploy.
- The same Foundry build configuration and dependency/remapping versions used
  at deployment, including compiler version, optimizer settings, EVM version,
  constructor arguments, and linked-library addresses where applicable. The
  resulting creation/runtime bytecode must match the already-deployed
  contracts.
- The deployment records/artifacts the project generated (commonly its
  `broadcast/` and related deployment output). Do not assume a later clean
  checkout can reconstruct all needed constructor/deployment metadata without
  them.
- Normal network/RPC access and the project dependencies installed. The
  deployer private key is not needed merely to verify an existing deployment.

**An explorer API key from ops is not a prerequisite for the standard SE2
command.** Scaffold-ETH 2's verification flow handles the explorer submission
for this network, so the ticket should be unblocked by running the command and
checking the Base explorer pages for every deployed contract. If the command
reports a specific credential/configuration error, treat that as an actual
tooling failure to investigate—not a reason to wait for a generic API key.

## When to do it

Do it **now**, even though deployment was three days ago. Verification can be
performed after deployment; it does not change contract state or require a
redeploy. But it belongs to the live-contract phase immediately after a
successful deployment, not in the frontend/public-launch checklist.

The timing matters because the longer it is deferred, the more likely the
original compiler/settings, lockfile/dependencies, generated artifacts, and
deployment metadata are changed, cleaned, or hard to identify. That turns a
simple reproducible-build submission into a forensic exercise and can prevent
an exact bytecode match. Verifying now also lets users, integrators, and the
team inspect the live code and ABI during the remaining launch QA period, and
surfaces any proxy/library/constructor-argument issue while there is time to
fix documentation or release process before the announcement.

The practical checklist is therefore: preserve/commit (but never secrets from)
the deployment artifacts that the workflow needs, run `yarn verify --network
base` from the deployment-compatible revision, confirm each Base-mainnet
address is marked verified, and attach the explorer links/output to the ticket.
