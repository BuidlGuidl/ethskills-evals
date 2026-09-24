# Contract Verification Ticket

Unblock this now. Do not fold it into the launch checklist.

## What to run

From the repo root, use the Scaffold-ETH 2 command:

```bash
yarn install
yarn compile
yarn verify --network base
```

For the Foundry flavor, that command verifies the contracts from the Base deployment broadcast. In current SE-2 docs, `yarn verify --network <network>` is the intended command. If this project was generated from an older Foundry template and `--network base` is not forwarded correctly, run the underlying command directly:

```bash
cd packages/foundry
make verify RPC_URL=base
```

That is equivalent to:

```bash
cd packages/foundry
forge script script/VerifyAll.s.sol --ffi --rpc-url base
```

Because the deploy was `yarn deploy --network base`, the default broadcast path should be:

```text
packages/foundry/broadcast/Deploy.s.sol/8453/run-latest.json
```

If deployment used a non-default deploy script, the verify script or broadcast path needs to point at that script's `run-latest.json`.

## What needs to be in place

You need the repo state that produced the deployed bytecode: same Solidity sources, same `foundry.toml`, same compiler settings, same dependency versions, and the compiled artifacts under `packages/foundry/out`. If the branch has moved since deployment, check out the deployment commit before verifying.

You need the Base deployment broadcast file for chain ID `8453`, especially the transaction input data. SE-2's `VerifyAll.s.sol` uses it to discover contract addresses, contract names, constructor args, and linked libraries. If CI did the deploy, pull the `broadcast/` artifact from CI.

You need a working Base RPC endpoint. The template has `base = "https://mainnet.base.org"` in `foundry.toml`, so `RPC_URL=base` can work out of the box, but a team RPC is better for reliability.

You need explorer API configuration for Foundry verification. With Etherscan API V2, one Etherscan API key can be used across Etherscan-style explorers such as BaseScan. Put it in `packages/foundry/.env`, not in git:

```bash
ETHERSCAN_API_KEY=...
```

If the project's `foundry.toml` does not already map Base under `[etherscan]`, add this using the environment variable:

```toml
[etherscan]
base = { key = "${ETHERSCAN_API_KEY}" }
```

If the installed Foundry version or explorer config wants an explicit V2 URL, use:

```toml
[etherscan]
base = { key = "${ETHERSCAN_API_KEY}", chain = 8453, url = "https://api.etherscan.io/v2/api?chainid=8453" }
```

You do not need a funded wallet, a deployer private key, ownership of the contracts, or another transaction. Verification is not an onchain write.

## Is the API key really a blocker?

Not for a sprint. Current Scaffold-ETH 2 templates ship with default/example API keys so prototypes can verify without setup, and Foundry can also use a normal Etherscan API key for Base via API V2. For production, use your own team key to avoid shared-key rate limits and auditing ambiguity, but creating that key is a same-day task, not something to defer a month.

If ops owns all credentials, ask for only this minimum:

```text
ETHERSCAN_API_KEY with access to Etherscan API V2 / Base verification
```

No private key or deployer secret is required.

## When should it happen?

Run it now, as part of Phase 2/live-network validation, immediately after deployment. Since the Base deploy happened three days ago, do it today.

Timing matters because verification is easiest while the deployment commit, compiler output, deployment broadcast, constructor args, linked libraries, and team context are still fresh. Waiting until launch adds avoidable risk: source files may change, dependencies may update, artifacts may be cleaned, broadcast logs may be missing, explorer APIs may rate-limit, and a failed verification can become a launch blocker in front of users.

Verification also changes what reviewers and users can see on BaseScan. If the app already works against live contracts, the public should be able to inspect those contracts before the announcement, not only at the moment of announcement.

## Closeout criteria

The ticket is done when every deployed app contract on Base shows verified source on BaseScan, the verified addresses match `packages/nextjs/contracts/deployedContracts.ts`, and the exact command plus the deployment commit are recorded in the ticket.

References:

- Scaffold-ETH 2 agent docs: `yarn verify --network <network>` and `yarn deploy --network base` command surface: https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md
- Current SE-2 Foundry template verify target: https://github.com/scaffold-eth/create-eth/blob/main/templates/solidity-frameworks/foundry/packages/foundry/Makefile.template.mjs
- Foundry Etherscan config, including API V2 behavior: https://getfoundry.sh/reference/config/etherscan
