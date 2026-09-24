# Onchain scoring for the DePIN network

## Recommendation: Arbitrum (One, or an Orbit chain later) with the scorer as a Stylus contract

You have two hard constraints:

1. **One implementation.** The Rust routine that firmware runs must be the code that runs onchain.
2. **The Solidity stays.** ERC-20, staking and slashing stay as they are.

Stylus is the only production EVM environment that meets both without a proof system. It compiles Rust to WASM, and that WASM runs next to the EVM in the same state machine. Stylus and Solidity contracts call each other with normal ABI calls. Your routine is already a good fit:

- **Fixed-point integer math.** Stylus does not allow nondeterministic features such as floating point, so the "no floats" rule you already follow is exactly what it requires.
- **About 2k lines of pure compute.** Filtering and resampling is loop-heavy integer arithmetic. WASM runs that far cheaper than the EVM, often 10–100× less gas for compute-bound code. A Solidity port would be both a second implementation and expensive to run.
- **Self-checking.** A device can `eth_call` the scorer on its own samples for free and get the same number the reward contract uses. This is what ends the disputes.

Your Solidity contracts are plain EVM, so they deploy to Arbitrum unchanged. If the token is currently on Ethereum L1, either move staking/rewards to Arbitrum and bridge the token through the canonical gateway, or redeploy the reward system natively on Arbitrum. That is a one-time migration decision, not a code change.

## What runs onchain

```
crates/
  scoring-core/     # THE routine. no_std + alloc, pure fn, no I/O.
                    # Used by firmware, by the server, and by the Stylus contract.
  scoring-stylus/   # ~50 lines: stylus-sdk wrapper exposing scoring-core via ABI
contracts/          # existing Solidity: ERC20, Staking, Slashing, + RewardDistributor changes
```

**`scoring-core`.** This is your existing crate, made `#![no_std]` with `alloc`. Stylus has no std, and firmware probably doesn't either, so this may already be true. It keeps one entry point:

```rust
pub fn score(samples: &[Sample], params: &Params) -> u64
```

It gets no clock, randomness or globals, so its output depends only on its input. Firmware, the server and the contract all pin one git commit of this crate.

**`scoring-stylus`.** A thin wrapper:

```rust
#[public]
impl Scorer {
    pub fn score(&self, samples: Bytes, params: Bytes) -> U256          // pure
    pub fn score_signed(&self, device: Address, samples: Bytes,
                        sig: Bytes) -> U256                              // verifies device sig, then scores
    pub fn version(&self) -> FixedBytes<32>                              // git commit of scoring-core
}
```

Decode the samples in the same compact binary format the device already signs. Don't re-encode them into ABI arrays, which would double calldata and add a new place for divergence. If devices sign with ed25519 or P-256 rather than secp256k1, do the signature check here in Rust too. That is cheap in Stylus and expensive in Solidity.

**Keep onchain the data needed to check any score, not every score.** A few thousand devices × 24 hours comes to roughly 50–100k device-hours a day. Posting every raw hour as calldata and scoring all of it onchain works if an hour of samples is a few hundred bytes. At tens of KB per device-hour, the L1 data-availability cost of the calldata becomes your biggest bill, not the compute. Build for the second case:

- **Per epoch (hourly):** your aggregator posts one transaction to `RewardDistributor` containing:
  - a Merkle root of `(device, sampleHash, score)` leaves;
  - the raw sample data, as calldata or blobs posted by the rollup batcher, or on an Arbitrum AnyTrust/Orbit chain if you want cheap DA.

  Scores are computed offchain with the *same crate*.
- **Challenge window** (e.g. 24–72h): anyone, usually the operator, calls
  `RewardDistributor.challenge(epoch, device, samples, deviceSig, merkleProof)`.
  The Solidity contract:
  1. checks that `keccak(samples)` matches the leaf's `sampleHash` and that the proof matches the root;
  2. calls `IScorer(scorer).score_signed(device, samples, deviceSig)`;
  3. if the result differs from the posted score, overwrites that leaf's reward, slashes the aggregator's bond through your **existing Slashing contract**, and pays the challenger.
- **After the window:** devices claim with a Merkle proof, and Staking/ERC-20 pay out as today.

If sample volume turns out small, drop the optimistic layer. `RewardDistributor` then calls the scorer directly for every submission, and there is nothing to challenge. The contract interface stays the same, so you can begin with direct scoring and add the optimistic layer if gas bills require it, or go the other way.

### How the reward contract calls in

```solidity
interface IScorer {
    function score(bytes calldata samples, bytes calldata params) external view returns (uint256);
    function scoreSigned(address device, bytes calldata samples, bytes calldata sig) external view returns (uint256);
    function version() external view returns (bytes32);
}

contract RewardDistributor {
    mapping(uint64 epoch => IScorer) public scorerForEpoch; // pinned at epoch open
    ...
}
```

- It is an ordinary external `CALL`/`STATICCALL`. Solidity can't tell it isn't talking to another Solidity contract.
- **Pin the scorer per epoch.** Stylus contracts are immutable unless you add a proxy. Don't proxy the scorer. When the algorithm changes, deploy a new scorer and register it for future epochs through a timelocked governance call. Old epochs still resolve to the scorer they were scored under, so any historical score can be re-checked against the exact code that produced it. This is the dispute guarantee.
- Pass `params` (thresholds, weights) as explicit arguments stored by epoch in Solidity, not as mutable state inside the scorer. The scorer stays a pure function.

## What the deploy pipeline must do that a Solidity deploy doesn't

1. **Pin the toolchain and build reproducibly.** Commit `rust-toolchain.toml`, pin `stylus-sdk` and `cargo-stylus`, and build inside the `cargo stylus` reproducible Docker image. CI must produce a byte-identical WASM so that `cargo stylus verify` (and Arbiscan's Stylus verification) can tie the deployed code to a source commit. Without this, operators can't confirm the deployed scorer is the code in firmware, and the onchain move gains you nothing.
2. **Check size and validity.** Run `cargo stylus check` against the target chain. It validates the WASM (no floats, no disallowed imports) and the size limit, which is about 24 KB *brotli-compressed*. 2k lines of integer code usually fits, but budget for it:
   - build with `opt-level = "z"`, LTO, `panic = "abort"` and `codegen-units = 1`;
   - run `wasm-opt`;
   - strip `core::fmt` usage from the onchain path, since panic messages and `Debug` formatting are the usual bloat.

   Fail CI when the compressed size exceeds about 80% of the limit.
3. **Deploy in two steps: deploy, then activate.** After the bytecode is deployed, it must be **activated**. Activation is a transaction to the `ArbWasm` precompile that compiles the WASM to native code onchain and charges a data fee in ETH. The program can't be called until this succeeds. `cargo stylus deploy` does both steps, but your scripts must handle activation failures and fund the fee.
4. **Keep activation alive.** Activations **expire**. A program must be reactivated about once a year, and possibly after ArbOS upgrades that bump the Stylus version. An expired scorer makes `challenge`/`score` revert, which freezes rewards. Add a monitor on `ArbWasm.programTimeLeft` / `codehashVersion` and a runbook (or keeper) that calls `activateProgram` again well before expiry. Solidity contracts need nothing like this.
5. **Prove the implementations match on every commit.** Keep a golden test-vector corpus of real device-hours with expected scores, including edge cases like gaps, overflow and clipping. CI runs it:
   - natively (`cargo test`);
   - on the firmware target, or under its emulator;
   - against the deployed WASM on a local `nitro-devnode`, via the Solidity `RewardDistributor` path, not only the scorer directly.

   All three must match bit for bit. This test suite is what makes "one implementation" true in practice, not just in the repo layout.
6. **Record provenance onchain.** At deploy, register `version()` (the git commit) and the WASM codehash in `RewardDistributor` alongside the epoch mapping. Publish the reproducible-build instructions so an operator can rebuild and compare.
7. **Measure gas.** Stylus meters in "ink" and charges for memory pages, and a large sample buffer grows memory. Benchmark `score_signed` on a worst-case hour in CI. The challenge transaction must stay well under the block gas limit, or disputes become impossible exactly when they matter.
8. **Audit the whole stack.** Audit the Stylus wrapper and the decoding boundary as well as the Solidity. A panic in `scoring-core` on malformed input becomes a revert. Decide on purpose whether a revert means "score = 0" or "challenge invalid", and handle it in Solidity.

## What would make this the wrong choice

- **You need to be on a chain other than Arbitrum.** Say liquidity, partners or the token must be on Ethereum L1, Base or Solana. Then Stylus is unavailable, and the answer becomes a **zkVM (SP1 or RISC Zero)** running the same `scoring-core` crate. Only a small verifier contract is deployed, and it works on any EVM chain. You would pay with proving infrastructure and cost, and devices could no longer "just `eth_call`" to check a score.
- **Raw samples must stay private, or grow too large to post even for disputes.** Stylus re-execution needs the inputs in public at challenge time. A zkVM proves the score from a commitment without revealing or posting the data.
- **Scoring changes from deterministic integer math to floats or a large ML model.** Floats are forbidden in Stylus. A model large enough to break the size or gas limits can't run onchain at all. You would need ZK/optimistic offchain compute, or you would accept trusted scoring again.
- **The score becomes relative across the network,** e.g. a device's rank against all devices that hour. Then checking one device's score needs everyone's data in one transaction, and single-device re-execution stops working.
- **You're willing to maintain two implementations after all,** or the routine shrinks to something trivial. Then a plain Solidity scorer works on any chain with no Stylus-specific pipeline. That rules out the reason for choosing Arbitrum.
- **Disputes stop mattering,** e.g. operators trust you, or rewards become flat. Then onchain scoring costs more than it saves. Signed, published offchain scores with a Merkle root would be enough.
- **You can't accept Arbitrum's trust model or the yearly-reactivation operational burden.** That model is a centralized sequencer (with forced inclusion via L1) and a Stage-1 rollup with a security council. The alternative is L1 plus ZK.

The choice rests on four facts: the scorer is **deterministic, integer-only, moderate-sized, per-device, and publicly checkable**. While all four hold, Stylus on Arbitrum is the only option that runs your existing Rust as-is, right next to your existing Solidity, with nothing extra like a prover to operate.
