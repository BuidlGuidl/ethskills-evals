# Unblocking the Base mainnet verification ticket

**TL;DR:** The ticket isn't actually blocked, and it shouldn't wait for launch.
Verification on Base does not require an ops-provisioned key at all (Blockscout
and Sourcify are keyless), and even the Basescan path needs one free
self-serve Etherscan key, not a procurement cycle. More importantly,
verification is a function of the *deploy artifacts and the exact source tree
that produced them* — both of which decay over the next month. Run it this
week, against the deploy commit, while everything still matches.

> Assumptions, since the repo isn't checked out here: standard Scaffold-ETH 2
> foundry flavor, contracts under `packages/foundry`, deployed via
> `script/Deploy.s.sol`, Base mainnet = chain ID 8453. Verify the script names
> against `packages/foundry/package.json` before running; the raw `forge`
> commands in the fallback section are stable regardless of SE-2 version.

---

## 1. What we'd actually run

### The happy path (SE-2's built-in batch verifier)

```bash
cd packages/foundry        # or run from repo root
yarn verify --network base
```

Under the hood this is `forge script script/VerifyAll.s.sol --ffi ...`. That
script is not a redeploy — it reads the broadcast receipt from the last deploy:

```
packages/foundry/broadcast/Deploy.s.sol/8453/run-latest.json
```

and, for each contract recorded there, shells out (hence `--ffi`) to
`forge verify-contract` with the address, the fully-qualified contract path,
and the ABI-encoded constructor args pulled straight from the receipt. That
last part is the whole reason to use it: hand-encoding constructor args is
where manual verification usually fails.

**Before running, confirm `run-latest.json` is the Base deploy from three days
ago** and hasn't been clobbered by a later `yarn deploy` against Base. If it
has, the dated sibling files in the same directory (`run-<timestamp>.json`)
still hold the original — point at one of those, or use the fallback below.

### Fallback / per-contract (works on any SE-2 version, no FFI)

```bash
forge verify-contract \
  --chain-id 8453 \
  --watch \
  --constructor-args $(cast abi-encode "constructor(address)" 0xYourOwner) \
  0xDeployedAddress \
  src/YourContract.sol:YourContract
```

Add `--compiler-version`, `--num-of-optimizations`, and `--evm-version`
explicitly if `foundry.toml` has drifted since the deploy — these must match
the deploy-time settings *exactly* or the bytecode won't match.

### Keyless verifiers (use these to sidestep the ticket entirely)

```bash
# Blockscout — no API key required
forge verify-contract --chain-id 8453 --watch \
  --verifier blockscout \
  --verifier-url https://base.blockscout.com/api \
  0xDeployedAddress src/YourContract.sol:YourContract

# Sourcify — no API key required
forge verify-contract --chain-id 8453 --watch \
  --verifier sourcify \
  0xDeployedAddress src/YourContract.sol:YourContract
```

I'd do **both** Basescan and Blockscout/Sourcify. They're independent indexes,
it costs one extra command, and different tools in the ecosystem (Safe, Tenderly,
wallet simulators, security scanners) read from different ones.

---

## 2. What we actually need in place

| Requirement | Status / note |
|---|---|
| The **deploy commit**, checked out | Non-negotiable. Source must compile to byte-identical bytecode. Tag it now: `git tag base-mainnet-deploy <sha> && git push --tags`. |
| `broadcast/Deploy.s.sol/8453/run-latest.json` intact | This is the addresses + constructor args. It's gitignored in some setups — **check it still exists on someone's machine before it's lost.** |
| Matching `foundry.toml` | solc version, `optimizer`, `optimizer_runs`, `evm_version`, `via_ir`, remappings. Any change since deploy breaks the match. |
| Matching dependency commits | `lib/` submodules (OpenZeppelin etc.) pinned as they were at deploy time. |
| An explorer API key | **Only for the Basescan path.** Etherscan's unified V2 API means one key covers Base — anyone on the team can self-serve a free key at etherscan.io in about two minutes. Set `ETHERSCAN_API_KEY` in `packages/foundry/.env`. |
| A private key / deployer account | **Not needed.** Verification is a read-only HTTP submission. No signing, no gas, no transaction. |
| An RPC URL | Only needed to fetch on-chain bytecode; the public Base RPC is fine. |

Note the shape of that table: **the only entry the ops ticket touches is the
one row that's optional.** Everything genuinely load-bearing is stuff we
already control and that degrades with time.

---

## 3. Timing: now, not at launch

Verification should happen **as the last step of the deploy itself** — i.e.
retroactively, this week. Three reasons, in order of how much they'd hurt:

**a) The inputs rot.** Verification is a *reproducibility proof*: the explorer
recompiles our source and demands byte-identical output. Every day the repo
moves, the odds of an exact match drop. A bumped OpenZeppelin version, a
`foundry.toml` tweak, an `optimizer_runs` change, a Solidity version bump, a
refactor that renames a file — any of these can make the contracts we shipped
unverifiable from `main`. `broadcast/run-latest.json` is worse: it's overwritten
by the next deploy to the same chain and is gitignored in many SE-2 setups, so
a laptop reimage or a routine `yarn deploy --network base` quietly destroys the
constructor args. A month of normal two-person development is exactly the window
in which this goes wrong, and it fails *silently* — nobody finds out until the
day it's needed.

**b) Verification is not a launch task; it's a deploy task.** The contracts are
live on mainnet *now*. Anyone can find them, send them funds, and interact with
them — the announcement doesn't gate that, it only changes the volume. Right
now those addresses are opaque bytecode: no Read/Write Contract tab, no decoded
calldata in wallets or Safe, no source for anyone doing diligence. Unverified
mainnet code reads as either abandoned or deliberately obscured. We're already
carrying that cost.

**c) Bundling it into the launch checklist puts a debugging task on the
critical path.** Verification either works in 90 seconds or turns into a
bytecode-mismatch hunt: compiler settings, metadata hash, `--via-ir`,
library linking, rate limits, explorer-side outages. That's a fine afternoon
in a normal week and a terrible hour on announcement day. And the failure mode
compounds — if we discover at launch that the deployed contracts *can't* be
verified from current source, the only remedies are redeploying (new addresses,
migrating state, re-pointing the frontend) or shipping with permanently
unverified contracts. Neither is a launch-day decision.

The counter-argument for batching — fewer context switches — doesn't hold up,
because verification is **idempotent, reversible-by-irrelevance, and free**:
no gas, no key, no state change, no risk to the live contracts. There's nothing
to batch. It's an append-only fact about addresses that already exist.

One genuinely valid reason to delay: if we expect to **redeploy** before
launch. But then verify *this* deployment anyway (it costs nothing and proves
the pipeline works), and verify the new one at redeploy time too.

---

## 4. Suggested ticket update

> **Unblocked.** The ops API key is not a dependency:
> - Blockscout and Sourcify verification require no key at all.
> - Basescan uses Etherscan's unified V2 API — a free self-serve key, not an
>   ops provision.
>
> **Do not defer to launch.** Verification must be run against the exact commit
> and broadcast artifacts that produced the deployment, and both degrade as the
> repo advances. Deferring risks the contracts becoming permanently
> unverifiable, and it front-loads a debugging task onto announcement day.
>
> **Action items (this week):**
> 1. Tag the deploy commit and push the tag.
> 2. Locate and back up `packages/foundry/broadcast/Deploy.s.sol/8453/run-latest.json`
>    (commit it, or attach it to this ticket) — this is the single highest-risk artifact.
> 3. From the tagged commit: `yarn verify --network base`.
> 4. Repeat against Blockscout and Sourcify for redundancy.
> 5. Paste the verified explorer links into the README / launch doc.
> 6. Follow-up: make verification a standing step of the deploy runbook, so
>    this never becomes a separate ticket again.
