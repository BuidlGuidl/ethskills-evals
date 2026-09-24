# Contract verification on Base — unblocking the ticket

**Short version:** the ticket isn't actually blocked. There is no ops dependency
here: an Etherscan API key is free, self-serve, and takes about two minutes to
create, and there are two additional verification paths (Blockscout, Sourcify)
that need no key at all. Verification should happen **today**, not at launch.
Batching it into the launch checklist adds risk to launch day and gets
progressively more likely to fail the longer we wait.

---

## 1. Why the "blocked" status is wrong

The ticket says we're waiting on "a block explorer API key from ops (ETA next
sprint)." Three things to correct:

- **The key isn't an ops resource.** Etherscan API keys are issued instantly and
  for free from a self-registered account at <https://etherscan.io/myapikey>.
  Any teammate can create one now. There is no procurement, no approval, no cost.
- **It's one key for all chains now.** Etherscan's V2 API is multichain — a
  single `ETHERSCAN_API_KEY` covers Base (chain ID 8453) and everything else.
  Separate per-chain Basescan keys are the old model and no longer needed.
  (If someone is chasing a *Basescan-specific* key, that's the source of the
  confusion, and it's chasing a thing that no longer exists as a separate item.)
- **Even with zero keys, we can verify right now.** Blockscout
  (`https://base.blockscout.com`) and Sourcify both accept verification without
  an API key. Foundry supports both via `--verifier`. So the stated blocker
  doesn't block the stated work under any reading.

Practical first step before anything else: **check whether the contracts are
already verified.** If `yarn deploy --network base` was run with verification
flags configured, Foundry may have verified at deploy time. Open each deployed
address on <https://basescan.org> and look for the green checkmark / "Contract"
source tab. If it's there, close the ticket. If Basescan shows raw bytecode
only, continue below.

---

## 2. What we'd actually run

Scaffold-ETH 2 (foundry flavor) ships a verification path that reads the
deployment artifacts from the original deploy, so the normal case is one command
from the repo root:

```bash
yarn verify --network base
```

Under the hood this builds with build-info enabled and runs the SE-2
`VerifyAll` forge script, which walks the broadcast artifacts from the deploy
and calls `forge verify-contract` for each contract it finds — including the
correct ABI-encoded constructor arguments, which is the part that's most
annoying to reconstruct by hand.

> Note: SE-2 has churned on script names across versions (`yarn verify`,
> `yarn foundry:verify`, `yarn verify --network base`). Check
> `packages/foundry/package.json` for the exact `verify` script and how it takes
> the network argument before running — the shape above is the common one, but
> confirm against the repo rather than trusting this doc.

### Manual fallback, per contract

If the SE-2 wrapper misbehaves (it's the most common failure mode — FFI
disabled, artifacts moved, script drift), fall back to calling Foundry directly.
This always works and is worth knowing regardless:

```bash
forge verify-contract \
  --chain-id 8453 \
  --watch \
  --compiler-version "v0.8.20+commit.a1b79de6" \
  --num-of-optimizations 200 \
  --constructor-args "$(cast abi-encode 'constructor(address)' 0xYourOwnerAddress)" \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  0xDeployedContractAddress \
  contracts/YourContract.sol:YourContract
```

Every one of those values must match the deploy exactly — see §3.

### No-key alternatives (use these if anyone still insists the key is blocked)

```bash
# Blockscout — no API key required
forge verify-contract \
  --verifier blockscout \
  --verifier-url https://base.blockscout.com/api? \
  --chain-id 8453 --watch \
  --constructor-args "$(cast abi-encode 'constructor(address)' 0xYourOwnerAddress)" \
  0xDeployedContractAddress contracts/YourContract.sol:YourContract

# Sourcify — no API key required, and it's the canonical/decentralized record
forge verify-contract \
  --verifier sourcify \
  --chain-id 8453 \
  0xDeployedContractAddress contracts/YourContract.sol:YourContract
```

These aren't mutually exclusive. Verifying on **Basescan + Sourcify** is the
sensible end state: Basescan is what humans and most integrators look at,
Sourcify is what tooling (wallets, Safe, decoders) increasingly resolves
against and it isn't a single vendor.

---

## 3. What actually needs to be in place

This is the real content of the ticket, and none of it is an API key.

**Verification is a byte-for-byte reproduction problem.** Etherscan recompiles
the source we submit and compares the resulting bytecode to what's on chain. If
anything differs, it fails. So we need, exactly as they were at deploy time:

1. **The deployment artifacts.** In SE-2 foundry these are
   `packages/foundry/broadcast/Deploy.s.sol/8453/run-latest.json` (plus the
   timestamped siblings) and the generated `deployments/` JSON. These carry the
   deployed addresses and the constructor arguments. **Confirm these are
   committed to git.** If they were produced on a teammate's laptop and never
   committed, they exist in exactly one place and that's a single point of
   failure — fix that today.
2. **The exact source tree that was deployed.** The commit that was live on
   `main` three days ago. Tag it now (`git tag deploy/base-2026-09-19 <sha>`)
   so it can't be lost in a month of merges.
3. **The exact compiler settings.** From `foundry.toml`: `solc` version,
   `optimizer` on/off, `optimizer_runs`, `evm_version`, `bytecode_hash`, and
   critically **whether `via_ir` was enabled**. IR-compiled bytecode will not
   match a non-IR recompile. Also pin the Foundry version — `forge --version`
   from the machine that deployed, because solc resolution and metadata can
   shift between Foundry releases.
4. **Dependency versions.** `lib/` submodule commits (OpenZeppelin, Solmate,
   whatever) and `remappings.txt`. A bumped dependency changes the bytecode even
   if our own `.sol` files are untouched.
5. **Constructor arguments**, ABI-encoded. From the broadcast file if we have
   it; reconstructed with `cast abi-encode` if we don't.
6. **Any linked libraries**, if the contracts use external libraries — those
   need `--libraries` flags at verify time.
7. **`ETHERSCAN_API_KEY`** in `packages/foundry/.env`, and a `[etherscan]`
   section in `foundry.toml` with a `base` entry (`chain = 8453`). Optional if
   going the Blockscout/Sourcify route.
8. **FFI enabled** (`--ffi`, or `ffi = true`) if using the SE-2 `VerifyAll`
   script, since it shells out per contract.

---

## 4. Timing: now, not at launch

Do it today. The teammate's "fold it into the launch checklist" instinct is
reasonable for things that are *launch actions*. Verification isn't one — it's a
**deploy action that got separated from its deploy**, and the cost of that
separation grows with time.

**Why now:**

- **Reproducibility decays.** Everything in §3 is a snapshot of the repo as it
  was three days ago. Today, reproducing it is trivial. After a month of merged
  PRs, bumped submodules, a Foundry upgrade, or a `foundry.toml` tweak, it's an
  archaeology exercise — and the failure is silent and confusing ("bytecode does
  not match"), not a clear error pointing at the cause.
- **Artifacts are perishable.** `run-latest.json` is overwritten by the next
  deploy to the same chain. One `yarn deploy --network base` for a redeploy or a
  new contract and the constructor args for the current deployment are harder to
  recover.
- **Launch day is the worst possible time to debug this.** Verification fails
  for fiddly reasons — a constructor arg encoded wrong, `via_ir`, a metadata
  hash mismatch, an unlinked library, a rate-limited API. Every one is a
  20-minute fix on a calm Tuesday and a crisis at T-minus-one-hour with an
  announcement queued.
- **Verification is an input to other pre-launch work.** Security review,
  third-party integrations, Safe transaction decoding, Dune/Tenderly decoding,
  indexers, and anyone doing diligence on us all want verified source. Leaving
  this "blocked" quietly blocks or degrades all of them, and those are exactly
  the things that want lead time before a public announcement.
- **The contracts are already live and already exposed.** The app is running
  against them and users can interact today. An unverified contract on Basescan
  shows a warning and gives users no way to read what they're approving — that's
  a trust problem *now*, not a launch-day cosmetic.
- **There's essentially no downside.** Verification is off-chain metadata
  publication: no transaction, no gas, no state change, no on-chain risk. It's
  idempotent and re-runnable. There is nothing to "save up."

**The one argument that would justify waiting** is if the source code is meant
to stay private until the announcement. It's worth naming so we can dismiss it
deliberately: the bytecode is already public on chain and modern decompilers get
a determined reader most of the way there, so verification isn't what reveals
the contracts — deployment was. If we do have a genuine confidentiality reason,
the answer isn't "verify later," it's "decide now that we're okay being
effectively public since three days ago," which is a different conversation. I
don't think it applies here given the app is already live against these
contracts.

---

## 5. Suggested ticket update

> **Unblocked.** No ops dependency — Etherscan API keys are free and self-serve
> (<https://etherscan.io/myapikey>), one key covers Base via the V2 multichain
> API, and Blockscout/Sourcify need no key at all.
>
> Steps:
> 1. Check Basescan — the contracts may already be verified from deploy time.
> 2. Tag the deployed commit; confirm `broadcast/` + `deployments/` artifacts
>    for chain 8453 are committed to git.
> 3. Create an Etherscan API key, add `ETHERSCAN_API_KEY` to
>    `packages/foundry/.env`, confirm the `[etherscan]` base entry in
>    `foundry.toml`.
> 4. Run `yarn verify --network base`; fall back to per-contract
>    `forge verify-contract` if the wrapper script fails.
> 5. Also verify to Sourcify (no key needed) for tooling/decoder coverage.
> 6. Paste verified Basescan links into the ticket and the launch checklist as a
>    *confirmation* item, not a *to-do* item.
>
> Target: this week. Not launch day — reproducing the exact compiler inputs gets
> harder as the repo drifts, and verification failures are fiddly to debug under
> announcement pressure.

---

**One caveat on this document:** the repo isn't checked out here, so the exact
`yarn` script name, the `foundry.toml` contents, the compiler version, and the
constructor signatures above are the standard SE-2 foundry shapes rather than
values read from our repo. Confirm them against `packages/foundry/foundry.toml`
and `packages/foundry/package.json` before running. The reasoning about what's
needed and when doesn't depend on those details.
