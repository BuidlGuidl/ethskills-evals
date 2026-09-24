Contract verification is not blocked on an ops-provided block explorer API key for a standard Scaffold-ETH 2 Foundry deployment. Treat it as an immediate Phase 2 follow-up to the Base mainnet deploy, not as something to fold into the launch checklist.

Run this from the same repo state that produced the successful Base deployment:

```bash
yarn verify --network base
```

If the repo uses the normal SE2 Foundry flow, that command should verify the deployed contracts recorded by the deployment artifacts / generated contract metadata. Do not manually edit `packages/nextjs/contracts/deployedContracts.ts`; SE2 generates that from deployment.

What needs to be in place:

- The exact source tree used for the deployed bytecode: Solidity files, deploy scripts, compiler version, optimizer settings, remappings, libraries, and constructor arguments must still match the deployed contracts.
- The deployment artifacts/broadcast output from `yarn deploy --network base` should still be present, or otherwise recoverable from CI/build artifacts, so the verifier can map deployed addresses to contract names and constructor data.
- Base must be configured as the target network in the SE2 project, and the deployer/RPC environment should be set up the same way it was for deployment.
- A working Base RPC endpoint is needed so the tooling can read the deployed bytecode and submit verification.
- Secrets must stay in local env files or CI secret storage. Do not paste API keys, RPC keys, or deployer keys into committed config.

When it should happen:

Run verification now, while the deployment is fresh, the deploy artifacts still exist, and the team still remembers exactly which commit/config produced the live contracts.

Why timing matters:

- Verification is a deployment validation gate. The app already points at live Base contracts, so the public contract source should be inspectable now, before broader launch traffic arrives.
- Waiting increases avoidable operational risk: artifacts get cleaned, branches move, compiler or optimizer settings change, deploy scripts are edited, constructor arguments become harder to reconstruct, and multiple deployments can make address/source matching less obvious.
- If verification fails, it is much cheaper to debug today than during a launch freeze or right before a public announcement.
- Verified contracts improve user, partner, and auditor confidence. Launch should not depend on a last-minute block explorer task that could have been completed right after deployment.

Ticket resolution: unblock the ticket by replacing "waiting on block explorer API key" with "run `yarn verify --network base` now from the deployed commit/artifacts; confirm contracts are verified on Base explorer; attach verified contract links."
