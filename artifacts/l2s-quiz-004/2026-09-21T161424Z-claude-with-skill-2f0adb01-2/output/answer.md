# Onchain scoring for the DePIN network

## Decision: Arbitrum One, with the scorer as a Stylus contract

The requirement that settles this is that you won't maintain a second implementation of the scoring routine. Arbitrum is the only major EVM chain that lets the Rust code you already have run as a contract. **Stylus** compiles Rust to WASM, and that WASM runs next to the EVM in the same chain state. Solidity and Stylus contracts call each other through ordinary ABI calls. Every other option means one of these:

- **Port it to Solidity** (Base, OP, mainnet, Scroll…): this creates the second implementation you ruled out. Across 2k lines of fixed-point math, the two versions will drift, and that drift is exactly what operators would dispute.
- **Prove it with a zkVM** (SP1 / RISC Zero running the same crate, with a Solidity verifier on any chain): this is possible, and it's covered below as the main alternative. It adds a prover pipeline, proving costs and a trusted-setup/verifier dependency. It doesn't give you what you asked for: scoring that runs onchain, which a device can call itself.

The routine is already a good fit for Stylus. Integer fixed-point math with no floats is deterministic under WASM, so the result is bit-for-bit reproducible. It also runs as compute-heavy work in WASM, which is where Stylus is 10–100x cheaper than the same logic in EVM bytecode.

Your ERC-20, staking and slashing contracts stay in Solidity. On Arbitrum you deploy them unchanged with the standard `solc` and Foundry/Hardhat. Only the RPC and chain ID change (chain ID 42161). If they currently live on L1 or another chain, they need to move to Arbitrum. The alternative is to keep the token where it is and settle rewards on Arbitrum with a bridged representation, which adds complexity. See the last section.

---

## What runs onchain

```
                ┌────────────────────────── Arbitrum One ──────────────────────────┐
 device ──sign──▶  SampleRegistry (Sol)     RewardDistributor (Sol)   Staking/Slashing (Sol, existing)
 hourly batch   │   commit(device, hour,  ──▶ reads scores, pays ERC-20 ──▶ slash on proven fraud
                │          root, sig)          │
                │                              │  IScorer(scorerForEpoch[e]).score(samples)
                │                              ▼
                │                         QualityScorer (Stylus / Rust → WASM)
                │                          = the same crate the firmware pipeline uses
                └──────────────────────────────────────────────────────────────────┘
```

### 1. The scoring crate is split into a core and thin wrappers
- `scoring-core`: `#![no_std]`, pure functions, `fn score(samples: &[Sample], params: &Params) -> Score`. It has no I/O and no allocator surprises, and it doesn't depend on `usize` width (see determinism below). This is the single implementation.
- `scoring-firmware` and `scoring-server`: your existing callers, now depending on `scoring-core`.
- `scoring-stylus`: a thin `stylus-sdk` wrapper, about 100 lines, that decodes ABI input, calls `scoring-core`, and returns `uint256`. It has no storage apart from a version constant. It's a pure function contract.

### 2. What data goes onchain, and when the scorer runs
A few thousand devices posting an hour of raw samples every hour is a lot of calldata to post unconditionally. Arbitrum's per-tx gas cap also limits how many samples one call can score. So the design is **commit always, compute on demand**:

1. **Commit (every hour, cheap).** Each device's hourly batch goes to `SampleRegistry.commit(deviceId, hour, merkleRoot, deviceSig)`. Your aggregator can batch many devices into one tx. Raw samples go to cheap public storage (your API plus IPFS/S3 mirror) keyed by root.
2. **Claim (every epoch).** Your operator posts the claimed score for each device-hour to `RewardDistributor`, against a bond. It computes these with the *same* crate off-chain.
3. **Check (free, any time).** Any device or operator can `eth_call` `QualityScorer.score(samples)` against a public Arbitrum RPC. That's the onchain code at zero cost, and it's how a device "checks its own reward".
4. **Dispute (onchain, paid by the disputer and refunded if they win).** `RewardDistributor.dispute(deviceId, hour, samples)` does four things:
   - verifies `keccak/merkle(samples) == committed root`
   - verifies the device signature: `ecrecover` for secp256k1, the RIP-7212 P-256 precompile for secure-element keys, or ed25519 inside the Stylus crate
   - calls the scorer inside the tx
   - if the result differs from the claim, overwrites the score, corrects the payout and slashes the claimer's bond through your existing slashing contract

   Claims settle after a challenge window. Pick hours to days: this is your own window, not the 7-day L1 withdrawal window.

If your hourly payload turns out small enough (measure it; see the pipeline below), you can skip the claim/dispute layer. In that case `RewardDistributor` calls the scorer directly on every submission. The call interface is identical, so you can start optimistic and move to full onchain scoring later, or the reverse.

### 3. How the reward contract calls into the scoring
Solidity doesn't know or care that the callee is WASM:

```solidity
// Generated by `cargo stylus export-abi`, committed to the Solidity repo
interface IQualityScorer {
    function version() external view returns (uint32);
    function score(bytes calldata packedSamples, bytes calldata params) external view returns (uint256);
}

contract RewardDistributor {
    mapping(uint64 epoch => IQualityScorer) public scorerForEpoch; // pinned per epoch
    ...
    uint256 s = scorerForEpoch[epochOf(hour)].score(samples, params);
}
```

- **Pin the scorer per epoch.** Don't make the scorer upgradeable through a proxy. A new scoring version is deployed at a new address and takes effect from a future epoch that governance announces. A dispute about hour H always runs the code that was live in hour H. Operators can see which binary scored them, and the firmware can embed the same `version()` constant.
- **Pack the samples.** Pass them as a packed `bytes` blob, not `uint256[]`. ABI-encoding thousands of 32-byte words wastes calldata, while a packed `i32`/`i64` fixed-point stream decodes almost for free in Rust.
- **Epochs use timestamps.** Derive `hour` and `epoch` from `block.timestamp`. On Arbitrum, `block.number` returns an **L1** block number, so it doesn't track L2 time.

---

## What your deploy pipeline needs beyond a plain Solidity deploy

1. **Rust→WASM toolchain, pinned.** Pin `rust-toolchain.toml`, the target `wasm32-unknown-unknown`, `cargo-stylus` and the `stylus-sdk` versions. Build inside `cargo stylus`'s Docker image so builds are **reproducible**. That's the property that lets an operator check that the deployed code hash matches a given git commit of `scoring-core`.
2. **Size budget.** Stylus limits the compressed WASM to about 24 KB. Build with `opt-level = "z"`, `lto = true`, `panic = "abort"` and `strip`, then run `wasm-opt`. Avoid `core::fmt` and panic-message strings, and keep an allocator out if you can. Run `cargo stylus check` in CI and fail the build if the binary gets close to the limit. 2k lines of integer math should fit, but it's the first thing that will break.
3. **Two-step deploy: deploy, then activate.** Deploying a Stylus program stores the WASM, and **activating** it goes through the ArbWasm precompile (`0x…0071`). Activation compiles the program to native code and costs a one-time data fee in ETH. `cargo stylus deploy` does both, but the pipeline must treat "deployed but not activated" as a failed deploy.
4. **Reactivation is recurring ops work.** Activations **expire after about 365 days**, and some ArbOS upgrades require reactivation. An expired scorer makes every dispute revert. Add a monitor that reads `ArbWasm.codehashAsmSize/programVersion` and expiry, plus a keeper that calls `codehashKeepalive` or reactivates well before expiry. This is also why you keep every epoch's pinned scorer alive for the full dispute window.
5. **Cross-target determinism tests.** These tests enforce "one implementation". Run a golden corpus of real device-hours, including edge cases, through:
   - the native `scoring-core` build (server)
   - the firmware target (probably 32-bit ARM)
   - the deployed WASM, via `cargo stylus` on a local `nitro-devnode`, called *from the Solidity contract* through Foundry fork tests

   All three must produce identical integers. Watch for `usize` width (wasm32 and ARM are 32-bit, the server is 64-bit), overflow that is wrapping in release but panics in debug, and shift/rounding in the fixed-point helpers. Also enforce "no floats" with `#![deny(clippy::float_arithmetic)]` in `scoring-core`.
6. **Gas ceiling tests.** Measure `score()` gas for the worst-case hour (maximum samples, worst-case filter path) on the devnode. It has to fit well inside Arbitrum's per-tx gas limit together with the Merkle and signature checks. This number decides whether you run optimistic or score everything onchain.
7. **ABI generation.** `cargo stylus export-abi` produces `IQualityScorer.sol` in CI. The Solidity build consumes the generated file so the interface can't drift by hand.
8. **Verification.** Verify the Stylus program on Arbiscan with the reproducible build (`cargo stylus verify`) and publish the commit hash → code hash → epoch mapping. Operators will trust the scores because they can trace that chain themselves.
9. **Solidity side unchanged.** Keep `forge script` against Arbitrum as today. The only new step is wiring `scorerForEpoch` after the Stylus deploy and activation.

---

## What would have to change for this to be the wrong choice

- **You drop the "one implementation" rule.** If you'd accept a Solidity port kept honest by differential tests, the choice of chain is open again. Then pick by where your token, stakers and liquidity are (mainnet, Base, etc.), not by VM.
- **You need every score proven, not just challengeable, *and* the data is too big to post.** If each device-hour grows to megabytes (higher sample rates, more sensors), or you want settlement with no challenge window, a **zkVM** fits better: SP1/RISC Zero running the same `scoring-core` crate, with a proof verified in Solidity. It still uses one Rust implementation and works on any EVM chain. The costs are the prover infrastructure, and devices can no longer simply `eth_call` the scorer.
- **Your contracts must stay on another chain.** If the ERC-20's liquidity, staking TVL or governance must stay on L1 or Base and you won't bridge, putting the scorer on Arbitrum means a cross-chain message for every dispute. Then a zkVM verifier on the home chain, or a port, is cleaner.
- **The scoring stops being small, pure integer code.** Floating point, an ML model, large lookup tables beyond the WASM size budget, or anything non-deterministic would push it out of Stylus. In practice that means off-chain compute with zk proofs or optimistic proofs.
- **The scoring changes constantly.** Weekly scoring changes mean a new deploy, activation, pinned epoch and keepalive entry each time. If the routine churns that fast, onchain pinning mostly adds ceremony, and a signed off-chain attestation is simpler. Its downside is that it doesn't settle disputes.
- **Operators don't really want to check their scores themselves.** If what operators want is a neutral arbiter rather than self-verification, an optimistic committee or oracle is simpler and doesn't need any code onchain.
- **Arbitrum-specific trust is unacceptable.** Stylus only exists on Arbitrum and Orbit chains, so you inherit Arbitrum's sequencer, governance and ArbOS upgrade cadence. If you need to be portable across chains, don't build around a chain-specific VM.
