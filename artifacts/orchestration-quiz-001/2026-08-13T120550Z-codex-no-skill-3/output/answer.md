# Unblock contract verification — Base mainnet (Foundry)

**Recommendation: verify now, as soon as ops supplies the key; do not make it a launch-day checklist item.**  This is a post-deploy action: it does not change contract state, require a deployer private key, consume gas, or require redeploying.  The live deployment has already happened, so it can be verified independently.

## What to run

From the exact commit/tag that was deployed (with its original `yarn.lock` and Foundry version), put the explorer key in the uncommitted Foundry environment file:

```dotenv
# packages/foundry/.env -- do not commit or print this
ETHERSCAN_API_KEY=<ops-supplied Etherscan V2 API key>
```

For the current Scaffold-ETH 2 Foundry template, the batch verifier reads the deployment broadcast and verifies every contract deployed by `Deploy.s.sol`. Run:

```sh
yarn verify base
```

That root wrapper resolves to the Foundry package's `verify` target and effectively runs:

```sh
cd packages/foundry
forge script script/VerifyAll.s.sol --ffi --rpc-url base
```

(`base` is the `rpc_endpoints.base` alias in `foundry.toml`; an explicit Base-mainnet RPC URL may be used instead.) `VerifyAll` obtains the addresses, constructor calldata, and, in recent template versions, linked-library addresses from `broadcast/Deploy.s.sol/8453/run-latest.json`, then invokes `forge verify-contract ... --chain 8453 --watch` for each deployment. It avoids manually re-entering constructor arguments, which is a frequent cause of failures.

Do **not** assume that `yarn verify --network base` is valid for the Foundry template: `--network` is the deployment-style flag, whereas this verifier receives an RPC alias/URL as its positional argument. Confirm the project's `package.json`/`packages/foundry/Makefile` before execution, because older generated versions can name the wrapper differently.

If the project does not contain the batch verifier or its broadcast artifact, verify each deployed address explicitly instead:

```sh
cd packages/foundry
forge verify-contract --watch --chain 8453 \
  --verifier etherscan --etherscan-api-key "$ETHERSCAN_API_KEY" \
  --constructor-args <ABI-encoded-original-constructor-args> \
  <DEPLOYED_ADDRESS> contracts/<File>.sol:<ContractName>
```

Repeat for each implementation/library/proxy contract as applicable. For external libraries, add one `--libraries path/Library.sol:Library:0x...` per linked library. If the project's Foundry version needs explicit explorer configuration, add `base = { key = "${ETHERSCAN_API_KEY}" }` under `[etherscan]` in `foundry.toml` (or supply the explicit flags above). Use the unified Etherscan V2 key/API, not a retired BaseScan V1 endpoint.

## What must be in place

- An Etherscan API key authorized for the V2 multichain service (Base is chain ID 8453), stored only in the secret manager/local ignored `.env`. This is the only missing external credential described in the ticket.
- A reliable Base-mainnet RPC endpoint. A public endpoint may work, but use the team's provider endpoint to avoid rate limits during verification.
- The immutable deployment inputs: deployed commit, Solidity sources including dependencies/remappings, exact `solc` release, optimizer enabled/runs, `via_ir`, EVM version, library links, and original constructor arguments. Recompile with that lockfile/config; changing any bytecode-affecting setting makes the explorer reject the submission.
- The original Foundry artifacts and `broadcast/Deploy.s.sol/8453/run-latest.json` if using `VerifyAll`. Preserve/copy them from CI or the deployer workstation before cleanup. Confirm each address and deployment transaction against BaseScan first.
- A current enough `forge` that supports Base/Etherscan V2, and no secret-bearing output captured in CI logs. The verifier may be retried safely; a response saying it is already verified is success, not a reason to redeploy.

Verification proves that the published source recompiles to the bytecode at an existing address. It does not audit the code, change ownership, or validate the frontend configuration.

## Timing and launch gate

Run it **now** (immediately when the API key arrives), then independently check the BaseScan code pages and record the verified URLs in the release/launch checklist. Keep the public announcement gated on verified links, but do not defer the execution to the announcement window.

The important timing constraint is provenance, not chain finality: three-day-old Base deployments are already settled, and verification remains possible later. Waiting makes the operation less reproducible—branches, lockfiles, compiler/Foundry versions, remappings, CI artifacts, and the `run-latest.json` broadcast can drift or disappear. It also turns ordinary failures (wrong constructor args, an unverified implementation, a library link, an API quota issue, or an explorer queue delay) into launch blockers, when the two-person team has the least time to diagnose them. Verifying early lets users, integrators, and reviewers inspect the exact code well before the announcement and gives the team time to fix any source-matching problem without pressure.

References: [Foundry: verifying a pre-existing contract](https://getfoundry.sh/forge/deploying/#verifying-a-pre-existing-contract), [Foundry Etherscan configuration](https://getfoundry.sh/reference/config/etherscan/), [Etherscan V2 migration](https://docs.etherscan.io/v2-migration).
