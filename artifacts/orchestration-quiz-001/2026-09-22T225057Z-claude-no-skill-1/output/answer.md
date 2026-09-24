# Unblocking contract verification (Base mainnet, Scaffold-ETH 2 / foundry)

## TL;DR

- **The ticket isn't actually blocked.** Verification on Base needs either a *free,
  self-serve* Etherscan API key (one key now covers all Etherscan V2 chains, Base
  included) or **no key at all** if you verify via Blockscout or Sourcify. Nothing
  here requires ops.
- **Run it today, not at launch.** Verification needs no deployer key, no gas, and
  touches nothing on-chain — it's a read-only publish of source that already-public
  bytecode corresponds to. The only thing that *does* degrade with time is your
  ability to reproduce the exact build, and the `broadcast/` artifacts that make
  the one-command path work.
- **What to run:** `yarn verify --network base` from the repo root, after a `.env`
  with an explorer key (or the manual `forge verify-contract` fallback below).

---

## 1. What you'd actually run

Scaffold-ETH 2 (foundry flavor) ships a verify script that reads the deployment
record Foundry wrote during `yarn deploy` and submits each contract for you.

From the repo root:

```bash
# 1. Make sure you're on the exact commit that was deployed
git log --oneline -5          # find the commit you deployed from
git status                    # must be clean; no uncommitted contract edits

# 2. Put the key in packages/foundry/.env
#    ETHERSCAN_API_KEY=<your key>      (older SE-2 templates: ETHERSCAN_V2_API_KEY)

# 3. Verify
yarn verify --network base
```

Under the hood that resolves to roughly:

```bash
forge build --build-info --build-info-path out/build-info/ \
  && forge script script/VerifyAll.s.sol --ffi --rpc-url base
```

`VerifyAll.s.sol` walks `packages/foundry/broadcast/Deploy.s.sol/8453/run-latest.json`,
pulls each deployed address **and its constructor arguments**, and calls
`forge verify-contract` per contract. That's the whole reason the one-command path
works — and the reason timing matters (see §3).

Check the exact script name/flags in `packages/foundry/package.json` before running;
the template has changed shape across SE-2 versions. If `yarn verify` doesn't take
`--network`, the network comes from `foundry.toml`'s default or an explicit
`--rpc-url base`.

### Manual fallback (per contract)

Useful if the script fails on one contract, or if `broadcast/` is gone:

```bash
forge verify-contract \
  0xYourContractAddress \
  src/YourContract.sol:YourContract \
  --chain 8453 \
  --constructor-args $(cast abi-encode "constructor(address,uint256)" 0xOwner 1000) \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --watch
```

`--watch` polls until the explorer returns a verdict instead of just handing you a
GUID. To check a GUID later: `forge verify-check <guid> --chain 8453`.

### No-API-key routes (work right now, today)

```bash
# Blockscout — no key required
forge verify-contract 0xYourContractAddress src/YourContract.sol:YourContract \
  --chain 8453 \
  --verifier blockscout \
  --verifier-url https://base.blockscout.com/api/ \
  --constructor-args $(cast abi-encode "constructor(...)" ...)

# Sourcify — no key required, and Basescan/Blockscout can both source from it
forge verify-contract 0xYourContractAddress src/YourContract.sol:YourContract \
  --chain 8453 --verifier sourcify
```

I'd do **both** Etherscan-family (Basescan, what most users click through to) and
Sourcify (what tooling like Safe, Tenderly and wallet simulators consume).

---

## 2. What you actually need in place

| Requirement | Status / note |
|---|---|
| An explorer API key | Free, self-serve at etherscan.io — sign up, create a key, done in ~5 minutes. Since Etherscan V2, **one key covers Base (chainid 8453)**; you do *not* need a separate Basescan account. Or skip keys entirely via Blockscout/Sourcify. |
| `foundry.toml` `[etherscan]` entry | Should have something like `base = { key = "${ETHERSCAN_API_KEY}", chain = 8453 }`. If you're on an older Foundry that predates Etherscan V2, add `url = "https://api.etherscan.io/v2/api?chainid=8453"` or pass `--verifier-url`. |
| `packages/foundry/.env` | `ETHERSCAN_API_KEY=...`. Confirm `.env` is gitignored (SE-2 ships it that way). |
| The exact source + compiler settings used at deploy | Same commit, same `solc` version, same `optimizer` / `optimizer_runs` / `via_ir` / `evm_version` in `foundry.toml`, same library versions in `lib/`. A one-character difference in source or one changed optimizer run count produces different bytecode and the explorer rejects it. |
| `packages/foundry/broadcast/.../8453/run-latest.json` | This is what supplies addresses and constructor args. Needed for the one-command path. |
| Constructor args | Recoverable from `broadcast/` or from the deployment tx's input data on Basescan if you have to do it by hand. |
| A deployer private key / gas | **Not needed.** Verification is an off-chain API submission. No signing, no transaction, no funds at risk. |

Extra cases worth checking before you start:

- **Proxies.** If anything is behind a proxy, verify the implementation, then use the
  explorer's "Is this a proxy?" flow (or `forge verify-contract` on the implementation
  plus the proxy contract separately) so Basescan shows the right read/write ABI.
- **Linked libraries.** If any contract links an external library, the library must be
  verified too and the link addresses passed through — `VerifyAll` usually handles this,
  manual runs may not.
- **Contracts deployed by other contracts** (factory-created clones) won't appear in
  `broadcast/`; verify one instance manually and the explorer will match the rest by
  bytecode.

---

## 3. When: now, not at launch

Do it this week. Three independent reasons, strongest first.

### a) The artifacts that make it easy are perishable — the source of truth decays

The whole `yarn verify` convenience depends on `broadcast/.../8453/run-latest.json`
and a build that byte-for-byte reproduces what's on chain. Over the next month of
normal development that gets fragile in ordinary, unglamorous ways:

- `run-latest.json` is **overwritten by the next `forge script` broadcast** against
  that chain. (Timestamped `run-<ts>.json` siblings survive, but now someone has to
  know that and pick the right one.)
- `forge clean`, a fresh clone, a CI cache wipe, or a machine reimage removes `out/`
  and `cache/`.
- A `forge update` / dependency bump in `lib/`, a `solc` version change, or an
  optimizer-settings tweak in `foundry.toml` — any of which is a perfectly reasonable
  thing to do during a pre-launch month — breaks bytecode reproducibility. Recovering
  then means bisecting to find the build that matches, which is genuinely unpleasant.

Verification is *easiest right now* and monotonically harder every week you wait.
That, not the API key, is the real deadline on this ticket.

**Do this today regardless of when you verify:** tag and push the deployed commit, and
make sure `broadcast/` is committed.

```bash
git tag -a base-mainnet-deploy-2026-09-19 <deploy-commit> -m "Base mainnet deploy"
git push origin base-mainnet-deploy-2026-09-19
```

### b) The contracts are already live and already carrying real users

The app works against the live contracts *now*. That means unverified contracts are a
user-facing problem today, not a launch-day cosmetic item:

- Nobody — users, auditors, your future selves — can read the source on Basescan, and
  the Read/Write Contract tabs don't exist without an ABI.
- Wallet transaction simulators and security screeners degrade or warn on unverified
  contracts; some show scarier prompts.
- Downstream tooling that you'll want working *at* launch (Safe decoding, Tenderly,
  Dune decoders, Blockscout/Sourcify consumers, indexers) keys off verified source.
  Some of those have their own ingest lag — verifying a month early means they're
  warm by announcement day, verifying at launch means they're not.

There's no counterargument from secrecy: the bytecode is already public and
decompilable, so source disclosure isn't really a lever you still hold. The one
genuine check is whether the contracts contain anything you haven't announced yet —
unreleased features, a partner address, a pricing constant. Skim for that; if it's
clean (and for a shipped, live dApp it almost certainly is), publish.

### c) Launch checklists should contain rehearsed no-ops, not first attempts

Verification fails in fiddly ways the first time: metadata hash mismatch, wrong
optimizer runs, a missing library link, a proxy that needs a second step, an explorer
rate limit, a constructor-arg encoding that's off by a type. Every one of those is a
20-minute annoyance on a normal Tuesday and a crisis an hour before an announcement.

The teammate's "fold it into the launch checklist" instinct is right that it *belongs*
on the checklist — but it belongs there as a **verify-it's-still-green check**, not as
the first execution. Do the work now; on launch day the checklist line reads
"confirm all contracts show verified on Basescan + Sourcify," which takes 60 seconds
and can't fail in a new way.

Also worth naming: if verification surfaces something surprising — an address in
`broadcast/` that doesn't match what the frontend's `deployedContracts.ts` points at,
or a contract you forgot was deployed — you want to find that with a month of runway,
not on the critical path to a public announcement.

### The API-key objection, specifically

"Waiting on a key from ops" is worth dissolving rather than working around. The key is
used **only at verification time**, from a developer machine, to submit source to a
public API. It is not a runtime dependency, it isn't embedded in the app, and it grants
no authority over the contracts. So a free personal key used today costs nothing and
locks in nothing — if ops later issues an org key, you just use it for the next
deployment. There's no future cleanup created by not waiting.

And if there's a policy reason the team genuinely can't use any Etherscan account:
Blockscout and Sourcify need no key whatsoever, and Basescan can pick up the Sourcify
match. The blocker has at least three independent exits.

---

## 4. Suggested ticket update

> **Unblocked.** No ops dependency: Etherscan V2 keys are free and self-serve and cover
> Base (chainid 8453) with a single key; Blockscout/Sourcify need no key at all.
>
> **Plan (this week):**
> 1. Tag + push the deployed commit; confirm `packages/foundry/broadcast/` is committed.
> 2. Create a free Etherscan API key → `packages/foundry/.env`.
> 3. From the deployed commit, clean tree: `yarn verify --network base`.
> 4. Also submit to Sourcify (`--verifier sourcify`) for tooling consumers.
> 5. Spot-check each address on basescan.org: source shown, Read/Write tabs present,
>    proxy flow correct where applicable.
>
> **Moved to launch checklist:** "Confirm all Base mainnet contracts still show as
> verified on Basescan + Sourcify" — a verification step, not the verification work.
>
> **Why not at launch:** `broadcast/run-latest.json` gets overwritten by the next
> broadcast and exact bytecode reproducibility degrades with any dependency/compiler/
> source change, so this only gets harder; the contracts are already live and unverified
> for real users; and first-attempt verification failures are fiddly and don't belong on
> the announcement critical path.
