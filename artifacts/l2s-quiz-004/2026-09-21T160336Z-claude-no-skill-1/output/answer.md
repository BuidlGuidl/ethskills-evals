# Onchain scoring for the DePIN network

## Decision: Arbitrum One, with the scorer as an Arbitrum Stylus contract

Deploy on **Arbitrum One**. Compile the existing Rust scoring routine to WASM and deploy it as a
**Stylus** contract. Redeploy the existing Solidity contracts (ERC-20, staking, slashing, rewards)
on the same chain without changing them, apart from one new call into the scorer.

Why this fits:

- **One implementation.** Stylus runs Rust compiled to `wasm32` natively on Arbitrum, next to the
  EVM. The crate that the firmware pipeline and your server run becomes the onchain scorer. You
  don't port it to Solidity, and you don't keep a second copy.
- **Fixed-point integer math is what Stylus needs.** Stylus rejects WASM that contains
  floating-point instructions, because they would break determinism. Your routine is integer-only
  already, so it passes `cargo stylus check` without changes. Most codebases would have to be
  rewritten to get here.
- **Solidity and Stylus call each other directly.** A Stylus contract has a normal Solidity ABI
  and address. Your reward contract calls it like any other contract: same transaction, same
  revert behavior, no bridge, no oracle, no proof system.
- **Compute is cheap enough to run every hour.** Filtering and resampling an hour of samples is
  heavy on loops and arithmetic. In Solidity that would cost far too much gas. WASM execution in
  Stylus is roughly an order of magnitude or more cheaper for this kind of compute. At Arbitrum
  gas prices, scoring a few thousand devices an hour is an ordinary operating cost.
- **Operators can check their own score for free.** Anyone can `eth_call` `score(samples)` against
  the deployed contract, whose code is verified. Their result is exactly the number the reward
  contract used. That removes the disputes.

I chose Arbitrum One over an Orbit L3 or appchain because you don't need the extra operational
load, and One has the most liquidity and tooling for the token. The same design works on an Orbit
chain with Stylus enabled if you later want your own gas token or throughput.

---

## What runs onchain

```
                ┌────────────────────────────────────────────┐
 device ─signs─▶│ Submitter (your aggregator, or the device  │
 hourly samples │ itself, or any third party)                │
                └───────────────┬────────────────────────────┘
                                │ submitBatch(epoch, [ (deviceId, samples, sig) ... ])
                                ▼
┌───────────────────────────────────────────────┐
│ RewardManager.sol  (yours, Solidity)          │
│  - checks device is registered + staked       │
│  - calls scorer.scoreSigned(...)  ────────────┼──┐
│  - records score[epoch][device]               │  │  ordinary external call
│  - accrues ERC-20 rewards / triggers slashing │  │  (staticcall, view)
└───────────────────────────────────────────────┘  │
                                                    ▼
                          ┌─────────────────────────────────────────┐
                          │ Scorer (Stylus, Rust → WASM)            │
                          │  - parse raw sample bytes (shared crate)│
                          │  - verify device signature over bytes   │
                          │  - filter / resample / score            │
                          │    (shared crate, same code as firmware)│
                          │  - returns (uint32 score, bytes32 hash) │
                          │  - stateless, no storage                │
                          └─────────────────────────────────────────┘
ERC20.sol, Staking.sol, Slashing.sol — unchanged Solidity, redeployed on Arbitrum
```

### Crate layout (the step that keeps you at one implementation)

```
scoring-core/        #![no_std], no floats, the existing ~2k lines. The ONLY implementation.
  src/lib.rs         pub fn score(samples: &[Sample]) -> Score
  src/wire.rs        pub fn decode(bytes: &[u8]) -> Result<Vec<Sample>/iterator, Err>
firmware/            depends on scoring-core (unchanged)
server/              depends on scoring-core (becomes an indexer/preview tool, not the source of truth)
scorer-stylus/       thin wrapper: depends on scoring-core + stylus-sdk
  src/lib.rs         #[public] fn score(bytes) / scoreSigned(pubkey, bytes, sig)
```

`scorer-stylus` is about 100 lines of glue. It decodes calldata, calls `scoring_core::score`, and
returns the result. It contains no scoring logic.

Put two more things in Rust instead of Solidity:

- **Decoding the sample wire format.** Byte parsing is where two implementations drift apart.
  `scoring-core` already knows the format, so it should decode the bytes itself.
- **Checking the device signature.** Many devices sign with Ed25519. Checking Ed25519 in Solidity
  is expensive, but in Stylus it is cheap, and you can use the same Rust crate the firmware uses to
  sign. If your devices sign with secp256k1, `ecrecover` in Solidity also works. Either way, the
  scorer must only score bytes that the device actually signed. Otherwise the onchain score says
  nothing about the device.

Portability hazards to fix in `scoring-core` before going onchain:

- **`usize`/`isize` width.** `wasm32` is 32-bit and your server is 64-bit. Any arithmetic on
  `usize` (index math, lengths feeding into accumulators) can overflow on one target and not the
  other. Use explicit `u32`/`u64`/`i64` wherever a value feeds the score.
- **Overflow semantics.** Set `overflow-checks` the same way in every profile and for every target.
  Better, make wrapping, saturating or checked arithmetic explicit in the code. Firmware release
  builds that wrap while the Stylus build panics is a consensus bug in your reward system.
- **Allocation.** Stylus contracts need a global allocator (for example `mini-alloc`) if the core
  uses `Vec`. Streaming or fixed-buffer code is cheaper still, and memory costs gas.
- **Binary size.** A Stylus program must be at most about 24 KB after Brotli compression. 2k lines
  of integer DSP normally fits. Watch dependencies such as `serde`, formatting and `panic` strings.
  Build with `opt-level = "z"`, `lto = true`, `panic = "abort"` and `codegen-units = 1`, and add
  `wasm-opt` if needed.

### How the reward contract calls the scorer

The Stylus crate exports a Solidity interface. You check that interface into the Solidity repo:

```solidity
// generated by `cargo stylus export-abi`, committed, diffed in CI
interface IScorer {
    function scoreSigned(bytes32 devicePubkey, bytes calldata samples, bytes calldata sig)
        external view returns (uint32 score, bytes32 samplesHash);
    function version() external view returns (uint32);
}
```

```solidity
contract RewardManager {
    struct ScorerEpoch { IScorer scorer; uint64 fromEpoch; }
    ScorerEpoch[] public scorers;              // append-only history; timelocked governance adds entries
    mapping(uint64 => mapping(bytes32 => uint32)) public scoreOf;          // epoch => device => score
    mapping(uint64 => mapping(bytes32 => bytes32)) public samplesHashOf;   // for audit / disputes

    function submit(uint64 epoch, bytes32 deviceId, bytes calldata samples, bytes calldata sig) external {
        require(epoch < currentEpoch(), "epoch open");
        require(scoreOf[epoch][deviceId] == 0, "already scored");
        Device memory d = registry.device(deviceId);          // existing staking/registry
        require(d.staked, "not staked");

        (uint32 s, bytes32 h) = scorerFor(epoch).scoreSigned(d.pubkey, samples, sig); // reverts on bad sig / malformed data
        scoreOf[epoch][deviceId] = s;
        samplesHashOf[epoch][deviceId] = h;
        _accrue(deviceId, epoch, s);                          // existing reward math → ERC-20
        if (s < slashThreshold) slashing.flag(deviceId, epoch, s);
    }
}
```

Key points:

- **Keep the scorer stateless and `view`.** It has no storage, no owner and no admin. Every
  operator can reason about it as a pure function.
- **Version the scorer by epoch; never upgrade it in place.** Firmware and scoring change over
  time. Each change is a new Stylus deployment, appended to `scorers` with a `fromEpoch` behind a
  timelock. When someone checks an old hour, they check it against the scorer that was active for
  that hour. Don't put the scorer behind an upgradeable proxy: operators should be able to name the
  exact code that scored them.
- **Batch the submissions.** Add a `submitBatch` that loops over `submit` so the aggregator sends
  one transaction per N devices. Choose N so a batch stays well under the block gas limit.
  Include a per-device `try`/skip, so one malformed payload doesn't revert the whole batch.
- **Choose who submits.** Your aggregator can submit (simplest). The device or operator can submit
  their own data (fully trustless: nobody can censor their score). Or allow both, with
  first-writer-wins. Because the scorer checks the device signature, it doesn't matter who pays
  gas.
- **Data availability.** The raw samples are in calldata. That means they are posted to Ethereum
  as part of Arbitrum's batches, so anyone can re-derive any score. Operators never have to trust
  your server's logs again.

The dispute flow that replaces today's process:

1. The operator calls `IScorer.scoreSigned(pubkey, theirSamples, theirSig)` via `eth_call`. It is
   free and uses their own RPC.
2. They compare the result with `RewardManager.scoreOf(epoch, deviceId)` and the samples hash.
3. If both match, the score is final. There is nothing to argue about. If the signed samples they
   hold differ from what was submitted, they submit their own copy and the signature settles it.

---

## What the deploy pipeline must do that a Solidity deploy doesn't

| Step | Plain Solidity | Stylus scorer |
|---|---|---|
| **Toolchain pinning** | solc version | Pinned `rust-toolchain.toml` and `cargo-stylus` version. The build must be reproducible, because the codehash is how operators trust the scorer. Run it in the `cargo stylus` Docker image. |
| **Differential tests** | – | A golden-vector suite: recorded device-hours paired with their expected scores. Run it against the native build (server and firmware target) and the `wasm32` build, both natively and via `eth_call` on a Nitro dev node (`nitro-devnode`/testnode). Any mismatch fails CI. This is the gate that keeps it "one implementation" in practice as well as in name. |
| **Validity check** | – | `cargo stylus check` validates the WASM against Stylus rules: no floats, allowed host imports, the compressed size limit and memory limits. Fail the build on size regressions. |
| **Deploy = two transactions** | one `CREATE` | (1) deploy the Brotli-compressed WASM as contract code, then (2) **activate** it by calling the `ArbWasm` precompile (`activateProgram`), which charges an activation data fee in ETH. Until it is activated, calls to the contract revert. `cargo stylus deploy` does both, but your scripts must handle a failed or partial activation. |
| **Activation expiry / keepalive** | – | Activated programs expire (currently about one year). A Stylus version bump in an ArbOS upgrade can also require reactivation. Add a scheduled job that checks `ArbWasm.programVersion`/`programTimeLeft` for every scorer still referenced by `scorers[]`, including old ones used for disputes, and calls `codehashKeepalive` or reactivates. Put an alert on it. |
| **Caching (optional)** | – | Bid to put the scorer in the Stylus `CacheManager` (`cargo stylus cache bid`). Cached programs skip most of the per-call init cost, which matters when you call it thousands of times an hour. |
| **ABI export & drift check** | ABI comes from solc | `cargo stylus export-abi` generates `IScorer.sol`. Commit it, and have CI fail if the generated file differs from the committed one, so the Solidity side never calls a signature that doesn't exist. |
| **Verification** | Etherscan source verify | Reproducible-build verification (`cargo stylus verify` / Arbiscan Stylus verification) that ties the onchain codehash to a git commit. Publish the commit, the codehash, and the matching firmware release together. This artifact is what operators trust. |
| **Wiring** | constructor args | Deploying a scorer doesn't make it live. A governance transaction behind a timelock appends `(scorer, fromEpoch)` to `RewardManager`. The deploy script must check `version()` and run a golden vector through the deployed address before proposing it. |
| **Chain migration** | – | If the ERC-20, staking and slashing contracts live on another chain today, redeploy them on Arbitrum One, or bridge the token via the canonical Arbitrum bridge and keep a canonical L1 token. The rewards, staking and slashing contracts must be on the same chain as the scorer, because the call is synchronous. |

---

## What would have to change for this to be the wrong choice

Stylus is right because of four facts together: **the code is deterministic integer Rust, the input
for each device-hour is small enough to post, the contracts can live on Arbitrum, and you want
synchronous execution without proofs.** Break any one of them and the answer changes.

1. **The rewards must settle on a chain without Stylus.** For example, the token and staking have
   to stay on Ethereum L1, Base, or a non-EVM chain for liquidity or partner reasons. Stylus only
   runs on Arbitrum chains. → Run the **same Rust crate in a zkVM (SP1 or RISC Zero)** and verify
   a succinct proof in Solidity on whichever chain you need. You still have one implementation, but
   you add proving infrastructure, latency and prover costs.

2. **Raw sample volume grows beyond what's economical to post.** If you move to high-rate sensors
   and each device-hour becomes hundreds of KB or MB, calldata/DA cost dominates and putting every
   hour onchain stops making sense. → Keep the data offchain (in your own DA, or on Celestia or
   EigenDA) and either (a) prove the score with a zkVM, with only commitments onchain, or (b) run
   **optimistically**: post scores and a Merkle root of the samples, and run the Stylus scorer only
   on challenged hours. Option (b) keeps Stylus but changes the design.

3. **Raw measurements become private.** Examples are location, customer data, or anything
   regulated. Posting samples as calldata publishes them permanently. → Use a zkVM, which proves
   the score over private inputs, or a TEE.

4. **Scoring stops being a pure deterministic function.** If you add floating-point ML models,
   external data (weather feeds, cross-device comparisons over the whole network), or GPU
   inference, Stylus can't run floats and can't make external calls. → Use an oracle or
   coprocessor design, or zkML. A network-wide scoring function (scoring device A relative to every
   other device's data) also breaks the "check my own hour" model on any chain.

5. **The routine outgrows the Stylus size or compute envelope.** If it grows well beyond the
   compressed size limit (a big DSP library, lookup tables, 10× the code), or its cost per hour
   gets close to the block gas limit, you would have to split it across contracts or move to a
   zkVM, which has no practical code-size limit.

6. **Scale jumps by orders of magnitude while disputes become rare.** With millions of devices and
   no one disputing, paying to score every hour onchain is wasted money. → Use optimistic scoring
   (point 2b) or batch zk proofs. Stylus might still be the dispute engine, but it is no longer the
   default path.

7. **Trust or settlement requirements change.** If partners require settlement with Ethereum L1
   security, with no reliance on Arbitrum's sequencer, fraud-proof window or governance, then
   proving on L1 (zk) is the answer, not an L2 runtime.

8. **You're willing to maintain a second implementation after all.** If the routine shrinks to
   something small (say a few hundred lines) and stable, a Solidity port plus differential fuzzing
   against the Rust version lets you deploy on any EVM chain with a plain deploy pipeline. That
   constraint is the one ruling this out today.

If none of these apply, meaning small signed hourly payloads, deterministic integer Rust, and
contracts you can put on Arbitrum, Stylus is the only option that gives you onchain, synchronous,
freely reproducible scores from the exact code your firmware runs.
