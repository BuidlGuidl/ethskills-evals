# Contract verification ticket

Do this now, not during the launch checklist.

For a Scaffold-ETH 2 Foundry app that was deployed with:

```bash
yarn deploy --network base
```

the verification command should be run from the repo root, on the same source commit/config that produced the deployed bytecode:

```bash
yarn verify --network base
```

That is the documented SE-2 command for both Hardhat and Foundry. In the Foundry flavor, it delegates to `packages/foundry/script/VerifyAll.s.sol`, which reads the Foundry broadcast record for the current chain and verifies the deployed CREATE transactions instead of requiring us to manually reconstruct every constructor argument.

If this repo is on a generated SE-2 Foundry version whose `verify` script still expects the network as a positional argument, use the equivalent fallback:

```bash
yarn workspace @se-2/foundry verify base
```

or, from `packages/foundry`:

```bash
make verify RPC_URL=base
```

## What must be in place

1. An Etherscan API key exposed to the Foundry package:

```bash
export ETHERSCAN_API_KEY=...
```

or put it in `packages/foundry/.env`:

```bash
ETHERSCAN_API_KEY=...
```

This should be an Etherscan API key, not a separate BaseScan-only blocker. Etherscan API v2 keys are valid across similar Etherscan-family explorers, including BaseScan. SE-2 also documents `ETHERSCAN_API_KEY` as the env var for Foundry verification.

2. Base mainnet configured in `packages/foundry/foundry.toml`:

```toml
[rpc_endpoints]
base = "https://mainnet.base.org"
```

This is probably already true because `yarn deploy --network base` worked.

3. Foundry verifier config for Base. If the repo does not already have it under `[etherscan]`, add:

```toml
[etherscan]
base = { key = "${ETHERSCAN_API_KEY}" }
```

Recent Foundry uses Etherscan API v2, where that Etherscan key can be used for BaseScan. If verification complains about an unsupported or missing explorer config, update Foundry with `foundryup` and/or add the explicit Base verifier config above.

4. The exact deployment artifacts still present:

```text
packages/foundry/broadcast/Deploy.s.sol/8453/run-latest.json
packages/foundry/out/
```

`8453` is Base mainnet. `VerifyAll.s.sol` uses the broadcast file to find deployed contract addresses, constructor args, and linked libraries. If the team deployed with the default `yarn deploy --network base`, the broadcast path should be `Deploy.s.sol`. If a custom deployment script was used, verify from the matching broadcast file or adjust the verification script accordingly.

5. The source tree, compiler settings, remappings, optimizer settings, libraries, and Solidity version must match the deployed bytecode. In practice: run this from the deployed commit/tag, before anyone merges contract/config changes that make the bytecode harder to reproduce.

## Timing recommendation

Run verification now, while the deployment is only three days old and the deploy context is fresh.

Do not fold this into the launch checklist next month. Verification does not change the deployed contracts, does not require another deployment, and does not need the deployer key. It is a public metadata/source-code publication step against the already deployed addresses. The only thing we are waiting on is an API key/config, and that can be resolved immediately.

The timing matters because verification is deterministic but brittle around build context. If we wait until launch week, any of these can turn a five-minute task into a blocker: source changes after deployment, changed `foundry.toml` optimizer or remapping settings, missing broadcast files, updated dependencies, renamed deployment scripts, lost constructor args, or a rate-limited/shared explorer key. Launch week is also when we least want to discover that one contract needs a library mapping or that the local artifacts no longer match Base bytecode.

Acceptance criteria for closing the ticket:

```bash
yarn verify --network base
```

completes successfully, and every deployed Base mainnet contract address used by the app shows verified source on BaseScan.

Useful references:

- Scaffold-ETH 2 deploy/verify docs: https://docs.scaffoldeth.io/deploying/deploy-smart-contracts
- Foundry Etherscan config: https://getfoundry.sh/config/reference/etherscan/
- Etherscan Foundry verification docs: https://docs.etherscan.io/contract-verification/verify-with-foundry
