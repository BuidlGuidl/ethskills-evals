# Contract Verification Ticket

Unblock this now. Do not leave Base mainnet verification as a launch-day checklist item.

## What to run

From the Scaffold-ETH 2 repo root, on the exact deployed revision:

```bash
yarn install --immutable
yarn compile
yarn verify --network base
```

For a Foundry-flavor SE-2 app, `yarn verify --network base` runs the Foundry verification flow. Under the hood, SE-2's `VerifyAll.s.sol` reads the Base deployment broadcast file at:

```text
packages/foundry/broadcast/Deploy.s.sol/8453/run-latest.json
```

and submits each `CREATE` contract deployment for verification, reconstructing constructor args from the broadcast transaction input.

If the SE-2 wrapper cannot target BaseScan/Etherscan correctly in the current toolchain, use direct Forge verification for each deployed contract instead:

```bash
cd packages/foundry

forge verify-contract \
  --watch \
  --chain 8453 \
  --verifier etherscan \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  <DEPLOYED_CONTRACT_ADDRESS> \
  <path/to/Contract.sol:ContractName> \
  --constructor-args <ABI_ENCODED_CONSTRUCTOR_ARGS_HEX>
```

Use the SE-2 wrapper first because it already knows how to pull deployed addresses and constructor args from the Foundry broadcast artifact. Use the direct command only if the wrapper is missing the right broadcast file, picks the wrong deployment, or your Foundry version needs explicit `--verifier etherscan`.

## What must be in place

1. The exact source tree that produced the live Base bytecode.

   If contracts, compiler settings, remappings, optimizer settings, libraries, or dependencies changed after deploy, check out the deploy commit/tag before compiling and verifying. Verification is a bytecode match, not a best-effort source upload.

2. The Base deployment broadcast artifact from the real deploy.

   For Base mainnet, chain ID is `8453`, so the expected SE-2 Foundry file is:

   ```text
   packages/foundry/broadcast/Deploy.s.sol/8453/run-latest.json
   ```

   Confirm `run-latest.json` is the deployment from three days ago, not a later dry run or redeploy. If it is not, point verification at the correct broadcast run or use direct `forge verify-contract` commands.

3. Matching Foundry artifacts.

   Run `yarn compile` from the deployed revision so `packages/foundry/out` matches the deployed contracts. Keep the same lockfile/dependency state.

4. A Base RPC endpoint configured as `base`.

   SE-2's Foundry template normally has this in `packages/foundry/foundry.toml`:

   ```toml
   [rpc_endpoints]
   base = "https://mainnet.base.org"
   ```

5. An Etherscan API key available to Foundry.

   Put it in `packages/foundry/.env`:

   ```bash
   ETHERSCAN_API_KEY=<org-or-team-etherscan-api-key>
   ```

   This does not need to be a separate old-style "BaseScan only" key. Etherscan API V2 uses one Etherscan key across supported EVM explorers, including Base/BaseScan. If your `foundry.toml` has explicit `[etherscan]` mappings and verification cannot find the key for Base, add:

   ```toml
   [etherscan]
   base = { key = "${ETHERSCAN_API_KEY}" }
   ```

6. No deployer private key is needed for post-deploy verification.

   Verification submits source/build metadata to the explorer. It does not send a transaction and does not mutate the contracts.

## When to do it

Do it now, before the public announcement.

Timing matters because verification gets harder and riskier the longer we wait:

- The correct deploy metadata can get overwritten, cleaned, or confused with later deployments. SE-2's default verifier reads `run-latest.json`, so "latest" must still mean the real Base deploy.
- Source and build inputs drift. Even harmless-looking changes to dependencies, compiler version, optimizer settings, library addresses, remappings, or constructor args can make verification fail.
- If verification fails, the fix may require finding old artifacts, reconstructing constructor args, or, in the worst case, explaining why the public contract cannot be verified cleanly. That is exactly the kind of surprise we do not want on announcement day.
- Verification is public transparency, not a launch ceremony. The app is already live against Base mainnet contracts, so users, integrators, reviewers, and teammates should be able to inspect the source on the explorer now.

The launch checklist should only include "confirm BaseScan links are verified and included in launch materials", not "attempt verification for the first time".

## References

- SE-2 deploy docs: `yarn verify --network network_name`, Foundry uses `VerifyAll.s.sol`, and Foundry env key lives in `packages/foundry/.env`: https://docs.scaffoldeth.io/deploying/deploy-smart-contracts
- SE-2 agent guide: shared `yarn verify --network <network>` command and Base deploy examples: https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md
- Etherscan Foundry verification docs, including existing-contract verification: https://docs.etherscan.io/contract-verification/verify-with-foundry
- Etherscan V2 single-key model across supported EVM chains: https://docs.etherscan.io/introduction
- Foundry Etherscan config reference: https://getfoundry.sh/config/reference/etherscan
