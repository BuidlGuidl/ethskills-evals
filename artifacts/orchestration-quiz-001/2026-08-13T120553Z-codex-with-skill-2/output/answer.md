# Base mainnet contract verification

The ticket is not blocked on an explorer API key.  In Scaffold-ETH 2's Foundry workflow, verification is handled by the project tooling; the prescribed command is:

```bash
# From the original Scaffold-ETH 2 project root
yarn verify --network base
```

Run it **now**, against the contracts deployed three days ago.  It is a Phase-2 (live-contracts) task, not a launch-checklist item.  Once it succeeds, confirm each deployed Base address shows its source and compiler settings on the explorer, then close the ticket.  It can remain as a launch checklist *assertion* ("contracts are already verified"), but verification itself should not wait for launch.

## What must be in place

- Access to the original repository at the exact source revision used for the Base deployment, including the Foundry deploy scripts and generated deployment/build artifacts.  Do not attempt verification from a reconstructed or later-changed contract tree.
- The project dependencies and environment needed to run its normal `yarn` scripts (including its configured Base network/RPC access).  Follow the repository's existing secret-loading pattern; do not put RPC credentials, private keys, or any other secrets in `scaffold.config.ts` or Git.
- The deployed contract addresses and the exact compilation inputs that produced their bytecode: Solidity sources (including dependencies), compiler version/settings, constructor arguments, and any linked-library addresses.  The normal SE2 deploy/verification artifacts supply this when retained.
- A reachable Base mainnet RPC and the contracts' deployment transactions finalized on Base.  They already are, given the working live app and three-day-old deployment.

An API key from Basescan/another block explorer is **not** a prerequisite for this Scaffold-ETH 2 verification command.  Cancel or reclassify the ops-key dependency rather than waiting for next sprint.  If the command reports a concrete project-specific configuration error, capture that error and fix only that missing configuration; it is not a reason to defer verification wholesale.

## Why the timing matters

Verification proves that the published, human-readable source and compiler settings match the bytecode users are interacting with.  Doing it immediately while the deployment context is fresh makes the required constructor arguments, library addresses, compiler settings, and artifact files easy to recover and diagnose.  Delaying until launch increases the chance that source/dependencies/configuration have drifted, build or broadcast artifacts have been cleaned up, or the original deployer context is unavailable—turning a one-command post-deploy check into an incident during a time-critical launch window.

It also gives users, integrators, security reviewers, and support staff a verified source of truth before publicity drives traffic.  If verification exposes a mismatch or omitted metadata, the team still has time to investigate and make a measured decision before the announcement.  Launch day should focus on frontend release and final QA, not on discovering whether the live contracts can be independently inspected.
