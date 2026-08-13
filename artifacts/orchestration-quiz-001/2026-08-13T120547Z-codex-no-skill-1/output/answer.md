# Unblock: verify the already-deployed Base contracts now

Do **not** wait for the public announcement. As soon as Ops supplies a valid
Etherscan/Basescan API key, run this from the project root, checked out at the
exact commit that was deployed:

```sh
# put this in packages/foundry/.env (do not commit it), or export it for this shell
export ETHERSCAN_API_KEY='…'

yarn verify --network base
```

That is Scaffold-ETH 2's Foundry helper. It does not redeploy anything or use
the deployer's private key. It runs the Foundry `VerifyAll.s.sol` script against
the Base RPC and submits the contracts in the deployment record to the explorer;
the script watches for the result. If this particular project revision does not
accept `--network`, the equivalent underlying command from `packages/foundry` is:

```sh
forge script script/VerifyAll.s.sol --ffi --rpc-url base
```

First use `yarn verify --help` / inspect the root `package.json` rather than
guessing flags: some older SE2 Foundry templates accepted the network as a
positional argument. The task should record the BaseScan URLs for every verified
address and fail if any deployment is missing.

## What must be in place

1. A real Etherscan API key with access to Base. Base is chain ID **8453** and
   Etherscan's V2 verification API supports it. The key belongs in the ignored
   Foundry `.env`/secret store as `ETHERSCAN_API_KEY`, never in source control
   or a frontend environment variable. Ensure the project's `foundry.toml` and
   Foundry version are configured to use that key for Base (older configurations
   may need a `base` Etherscan entry or an upgrade to the V2-capable setup).
2. A working Base mainnet RPC endpoint named `base` in `foundry.toml` (or pass
   its URL explicitly). It is used to read chain state; public Base RPC is often
   sufficient, though a team's authenticated RPC is more dependable.
3. The exact deployment source state: the Solidity files, dependency lockfiles
   and remappings, `foundry.toml`, compiler/Foundry version, optimizer settings
   and runs, EVM version, and library addresses used three days ago. Rebuild
   from the deployment commit; do not verify from today's changed working tree.
4. The original Foundry evidence must still exist, especially
   `packages/foundry/broadcast/Deploy.s.sol/8453/run-latest.json` and the
   corresponding `out/` artifacts/build information. `VerifyAll.s.sol` reads
   that broadcast file to find each CREATE, address, transaction input,
   constructor arguments, and linked-library deployments. Recover it from the
   deploy machine/CI artifact if it was cleaned or overwritten.
5. If proxies were deployed, verify the implementation contracts first, then
   perform the explorer's proxy/implementation association for each proxy. A
   proxy address alone is not a substitute for verifying its implementation.

Before submitting, make a small release-evidence bundle: deployed git SHA,
chain ID 8453, deployer transaction hashes and addresses, `foundry.toml`, lock
files/remappings, and the broadcast + build artifacts. Run the normal compile
and tests at that SHA, then run verification and visually check that Basescan
shows the expected contract name, source, compiler settings, constructor
arguments, and (where applicable) proxy implementation.

## Why now, not in the launch checklist

Verification is an independent, non-state-changing release-completeness step;
there is no benefit to postponing it. Running it now lets the team discover an
incorrect compiler version, optimizer setting, constructor argument, library
link, missing broadcast artifact, unsupported explorer configuration, or bad API
key while the deployment context and CI artifacts are still easy to recover.
Each week makes that evidence more likely to be overwritten, dependencies/tool
versions to drift, and the exact build harder to reproduce.

It also gives users and reviewers source transparency before marketing sends
traffic to contracts holding real value. Launch-day verification creates an
avoidable single point of failure: a slow/rate-limited explorer or a verification
mismatch can leave the announced contract unverified at precisely the moment
people need to inspect it. Put a **check** in the launch checklist (all intended
Base addresses verified and links published), but make the verification itself a
separate, immediate release task.

References: Scaffold-ETH's current template exposes `yarn verify --network
<network>` and its Foundry verifier calls `forge verify-contract` using the
deployment broadcast. Etherscan documents source verification through its V2 API
and explicitly lists Base as chain ID 8453:
https://github.com/scaffold-eth/create-eth
https://docs.etherscan.io/api-reference/endpoint/verifysourcecode
