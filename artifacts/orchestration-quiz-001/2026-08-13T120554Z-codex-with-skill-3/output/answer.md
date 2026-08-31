# Unblock the Base verification ticket

Run this from the Scaffold-ETH 2 repository root:

```bash
yarn verify --network base
```

Run it **now**, not as part of the public-launch checklist.  In the
Scaffold-ETH 2 Foundry workflow, verification belongs immediately after a
successful `yarn deploy --network base`; it does not require an explorer API
key.  The existing ticket should therefore be unblocked by removing the
"waiting for ops" dependency and scheduling the command in the current
release-maintenance window.

## What must be available

- The same repository revision (or, at minimum, the exact Solidity sources)
  that produced the deployed bytecode, including any local dependencies.
- The original compiler version, optimizer/via-IR settings, EVM version,
  constructor arguments, libraries, and contract names.  In practice, use the
  deploy commit and keep its Foundry configuration and deployment/broadcast
  artifacts intact; changing these can make bytecode reproduction fail.
- A working Base RPC/network configuration and normal developer tooling
  installed (`yarn install`).
- Internet access to the verification service/block explorer.  A funded
  deployer wallet is *not* needed for verification because no transaction is
  sent.

Do not put an explorer, RPC, wallet, or other credential into source control.
If the project has separately configured secrets, keep them only in ignored
environment files; they are not a prerequisite for the standard SE2 verify
command.

## Suggested runbook

1. Check out the commit used for the Base deployment and preserve its
   deployment records.
2. From the repo root, run `yarn install` if dependencies are not already
   present.
3. Run `yarn verify --network base`.
4. Open BaseScan (or the explorer reported by the command) for every deployed
   contract and confirm that source code, compiler settings, constructor
   arguments, and proxy implementation (if applicable) are shown correctly.
5. Record the verified explorer links in the release notes and close the
   ticket. If it fails, save the full command output and resolve the
   reproducibility mismatch while the deploy context is still fresh.

## Why timing matters

Verification is a Phase-2 deployment validation gate, whereas a public
announcement is Phase 3.  Waiting adds no benefit and turns a small,
diagnosable deployment follow-up into a launch-day dependency.  It also makes
failure more likely to be expensive: build settings, artifact locations,
library addresses, constructor inputs, and deploy knowledge can drift or be
lost over weeks.  Verifying now gives users and reviewers readable source
before public attention arrives, exposes an accidental wrong build or address
early, and leaves the launch checklist focused on production frontend QA and
communications rather than contract forensics.
