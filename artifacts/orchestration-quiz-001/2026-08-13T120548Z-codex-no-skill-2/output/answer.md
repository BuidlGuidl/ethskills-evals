# Unblock contract verification — Base mainnet

**Recommendation: verify as soon as Ops supplies the key; do not defer it to the announcement.** This is a post-deployment, off-chain publication step, not a new deployment or a transaction. It needs no deployer private key, no ETH, and does not alter the live contracts. Since the app is already live, the ticket should be blocked only on the credential, with a short reproducibility check prepared now.

## The command

From the repository root, on the exact commit that was used for the Base deployment:

```sh
# Put the Ops-managed Etherscan/BaseScan API key in packages/foundry/.env
# as ETHERSCAN_API_KEY=... (do not commit this file or print the key).
yarn verify --network base
```

For the standard Scaffold-ETH 2 Foundry template, this dispatches to `packages/foundry` and runs its `VerifyAll.s.sol` script with the Base RPC. That script reads `broadcast/Deploy.s.sol/8453/run-latest.json`, finds every `CREATE` deployment in that run, recovers constructor arguments from the original deployment input, and invokes `forge verify-contract --chain 8453 --watch` for each one. Save the resulting BaseScan `#code` URLs (and the console log) in the release record.

If this project’s pinned Scaffold version has changed the root script, use the equivalent package command rather than guessing individual contract arguments:

```sh
cd packages/foundry
yarn verify RPC_URL=<the-same-Base-mainnet-RPC-URL>
```

The project script is preferable to manually calling `forge verify-contract`: it uses the recorded addresses, contract names, constructor calldata, and linked-library handling from the original deployment. A direct command is a recovery path only, and then must specify the exact address, `path/Contract.sol:Contract`, constructor-argument hex, compiler settings, and any libraries.

## What must be in place

1. An API key accepted by the Etherscan/BaseScan verification service. Store it as `ETHERSCAN_API_KEY` in the ignored `packages/foundry/.env` or inject it as a CI secret. Ensure the project’s `foundry.toml` maps Base to that key (for example, `[etherscan] base = { key = "${ETHERSCAN_API_KEY}" }`) if its pinned Foundry configuration does not already do so. An Etherscan key can be used for BaseScan’s Etherscan-compatible service.
2. A working HTTPS RPC endpoint for **Base mainnet (chain ID 8453)**. Use the same trusted provider/configuration selected by `--network base`; verification needs to read the on-chain deployment and its chain ID.
3. The exact deployment source and build inputs: the Git commit/tag, `foundry.toml`, `remappings.txt`, Solidity/Foundry version, lockfiles and dependencies, optimizer runs, EVM version, `via_ir` setting, and linked-library addresses. Do not upgrade the compiler or dependencies before verifying. BaseScan compares the submitted compilation with deployed bytecode; source that merely looks equivalent is insufficient.
4. The original Foundry artifacts, especially `packages/foundry/broadcast/Deploy.s.sol/8453/run-latest.json`, plus `out/` (or the ability to reproduce it from the locked commit). The Scaffold verifier relies on the broadcast file. Preserve/copy it into release evidence before cleaning build directories.
5. A known list of all deployed addresses, including implementations, proxies, libraries, and any factory-created instances. The standard script covers deployments recorded as `CREATE` in that broadcast run; check its output against this list. Verify proxy implementations and proxies as applicable, then make sure BaseScan recognizes the proxy/implementation relationship (submit proxy verification separately if it does not).
6. A controlled operator environment with the project dependencies and a current compatible Foundry installation. Run `yarn test` and `yarn compile`/`forge build` against the pinned commit before submission. These checks do not prove BaseScan verification, but catch a lost or non-reproducible build before the key is used.

## Timing and launch policy

Do the non-secret preparation now: freeze/tag the deployed commit, archive the broadcast JSON and deployment transaction hashes, inventory every address, and reproduce the build. The instant the key arrives, run the verification and inspect every BaseScan result. Make verified code and the explorer links a **release gate** for the public announcement, but not a task intentionally postponed until launch day.

Verification is possible three days or three months after deployment because it does not change chain state. Waiting is nevertheless the wrong operational choice:

- Users, integrators, and auditors can inspect the source and ABI immediately; unverified live contracts impose avoidable trust and integration friction.
- Failures commonly expose missing constructor data, library links, proxy handling, or a build-settings mismatch. Discovering one at launch turns a small release-engineering repair into a public incident or an announcement delay.
- Reproducibility gets harder with time as working trees, generated `broadcast`/`out` files, compiler versions, package resolutions, and team memory drift. The closer verification is to the already-successful deployment, the easier it is to prove the exact bytecode.
- It separates an external explorer/API dependency from the marketing critical path and leaves time to retry or use BaseScan’s manual Standard JSON route if necessary.

After it succeeds, change the ticket to done, retain the key only in secret management, and add the command plus the checks above to the deployment runbook. For future releases, make verification automatic immediately after a successful production deploy (or require it before the release is declared complete), then have the launch checklist merely confirm the already-verified BaseScan links.

References: [Scaffold-ETH 2 Foundry template verifier](https://github.com/scaffold-eth/create-eth/blob/main/templates/solidity-frameworks/foundry/packages/foundry/script/VerifyAll.s.sol), [Foundry verification with Etherscan-compatible explorers](https://docs.etherscan.io/contract-verification/verify-with-foundry), [BaseScan verification overview](https://info.basescan.org/how-to-verify-contracts/).
