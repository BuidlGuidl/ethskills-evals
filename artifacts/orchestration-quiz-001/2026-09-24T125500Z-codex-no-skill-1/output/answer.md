# Contract verification unblock

Run verification now, not right before launch.

From the repo root, for the Scaffold-ETH 2 Foundry flavor deployed with the default `yarn deploy --network base` flow, run:

```bash
ETHERSCAN_API_KEY=<team-etherscan-or-basescan-api-key> yarn verify --network base
```

Equivalent low-level command, if you want to bypass the root Yarn script:

```bash
cd packages/foundry
ETHERSCAN_API_KEY=<team-etherscan-or-basescan-api-key> make verify RPC_URL=base
```

That Makefile target runs:

```bash
forge script script/VerifyAll.s.sol --ffi --rpc-url base
```

`VerifyAll.s.sol` reads the Foundry broadcast file from the Base deployment, finds the `CREATE` transactions, derives constructor args from the deployment input, locates the compiled artifacts, handles linked libraries, and calls `forge verify-contract --chain 8453 --watch` for each deployed contract. This is verification only; it does not redeploy anything and should not require the deployer key or funded wallet.

What needs to be in place:

- A checkout of the same commit/source that produced the deployed bytecode.
- The Foundry artifacts and broadcast data for the Base deployment, especially `packages/foundry/broadcast/Deploy.s.sol/8453/run-latest.json`. If the deploy artifacts were not committed, use the deploy machine/CI artifact or restore them before verifying.
- `packages/foundry/foundry.toml` must contain the `base` RPC endpoint. The stock SE-2 Foundry template has `base = "https://mainnet.base.org"`.
- A valid explorer API key in `ETHERSCAN_API_KEY`, either exported in the shell or placed in `packages/foundry/.env`. For current Etherscan-compatible verification, one Etherscan/BaseScan API key is enough for Base; this does not need a private deployer key.
- The same compiler/settings/remappings/dependencies used at deployment. Do not upgrade Foundry, Solidity config, dependencies, or optimizer settings first.
- Network access to Base RPC and the Etherscan/BaseScan verification API.

Timing decision:

Do it now. Verification is a release-readiness task for the deployed contracts, not an announcement-day task. The bytecode is already public, users are already interacting with it, and verified source improves transparency, explorer UX, integrations, monitoring, and third-party review immediately.

The timing matters because verification failures are much easier to fix while the deployment context is fresh. Waiting a month increases the chance that the exact source, artifacts, broadcast file, dependency versions, compiler build, constructor args, or linked-library addresses drift or disappear. If verification fails at launch, the public announcement gets blocked by archaeology instead of a simple retry. If it fails now, there is time to recover artifacts, pin tooling, or manually verify individual contracts before anyone is waiting on the launch post.

Once verification succeeds, close the ticket and leave a smaller launch-checklist item: confirm the BaseScan contract pages show verified source for the live addresses.
