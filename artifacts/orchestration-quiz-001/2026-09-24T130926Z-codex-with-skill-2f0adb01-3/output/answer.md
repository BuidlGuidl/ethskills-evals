# Contract Verification Ticket

Run verification now, not during the launch checklist.

From the repo root, for the deployed Base mainnet contracts:

```bash
yarn verify --network base
```

For the current Scaffold-ETH 2 Foundry flavor, that command verifies all CREATE deployments recorded by the Foundry broadcast file for Base, including constructor args and linked libraries. If the wrapper is unavailable or the project has an older script shape, the equivalent lower-level command is:

```bash
cd packages/foundry
forge script script/VerifyAll.s.sol --ffi --rpc-url base
```

What needs to be in place:

- The same repo state used for the Base deployment, including matching Solidity sources, imports, `foundry.toml`, optimizer settings, compiler version, and remappings.
- The deployment broadcast artifact from the Base deploy, normally `packages/foundry/broadcast/Deploy.s.sol/8453/run-latest.json`. This is how `VerifyAll.s.sol` knows which contract addresses were deployed and what constructor args were used.
- The compiled Foundry artifacts in `packages/foundry/out`; run `yarn compile` first if needed.
- A working Base RPC endpoint in `packages/foundry/foundry.toml`; the stock SE-2 Foundry template has `base = "https://mainnet.base.org"`.
- Foundry installed and dependencies available.
- If Foundry/BaseScan asks for an explorer key, set it as an environment variable or CI secret, usually `ETHERSCAN_API_KEY`:

```bash
export ETHERSCAN_API_KEY=...
yarn verify --network base
```

That key is only for submitting source verification to the explorer. It is not a deployer key, does not authorize contract changes, does not need wallet funds, and should not block on privileged ops custody. Use a team-owned Etherscan/BaseScan API key if you have one; otherwise generate a normal explorer API key now and store it as a local/CI secret. Do not commit it.

Why now:

Verification is part of Phase 2, immediately after live deployment, not a Phase 3 launch chore. The longer we wait, the easier it is to lose or overwrite the exact broadcast JSON, change compiler settings, update dependencies, rename deployment scripts, or drift the source tree away from the bytecode that is already on Base. Any of those can turn a quick verification command into manual reconstruction of constructor args, libraries, and build metadata.

It also matters socially and operationally: the contracts are already live and users can already interact with them. Verified source lets the team, partners, auditors, and early users inspect the exact code at the live addresses before the public announcement. If verification fails, we want to discover that while there is still launch runway, not while everyone is trying to ship comms.

So the ticket should be unblocked as: run `yarn verify --network base` now, preserve the deployment artifacts, add only the minimal explorer API secret if the tool requires it, and keep "contracts verified on BaseScan" as a launch checklist confirmation rather than the first time we attempt it.
