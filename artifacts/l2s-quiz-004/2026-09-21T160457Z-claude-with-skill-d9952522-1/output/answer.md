# Onchain scoring for the DePIN network

## Decision: Arbitrum One, with the scorer as a Stylus program

What decides this is **"we will not maintain a second implementation of a 2k-line Rust routine."** Every EVM-only chain (OP Mainnet, Base, Scroll, Linea, zkSync Era, mainnet) would make you port the scorer to Solidity. Then there are two implementations, firmware and chain, and they will drift. Drift is exactly what your operators are disputing today.

Arbitrum Stylus runs Rust compiled to WASM next to the EVM, in the same state. Solidity can call it, and it can call back into Solidity. The scorer ships from the **same crate** the firmware pipeline uses. Your ERC-20, staking and slashing contracts stay as they are. Arbitrum is an optimistic rollup, so the same `solc` bytecode deploys with only a new RPC URL and chain id.

The codebase also suits Stylus. The scorer is fixed-point integer math with no floats, so it is deterministic by construction and the WASM build gives bit-identical results to the firmware build. As far as I know, Stylus also rejects floating-point in programs, so a float-based scorer would have needed a rewrite anyway. Confirm this against current Stylus docs.

Before you commit, confirm the details the list below depends on: Stylus is live on Arbitrum One, the current compressed program size limit, the activation fee, and the reactivation/expiry rules. Read them off current Arbitrum docs, not this document. These details change with ArbOS upgrades.

---

## What runs onchain

```
                      Arbitrum One
┌─────────────────────────────────────────────────────────────┐
│  RewardDistributor (Solidity, new)                           │
│    submitHour(device, hour, samples, sig)                    │
│      ├─ check device is registered + staked  → Staking (sol) │
│      ├─ verify device signature over samples                 │
│      ├─ score = IScorer(scorerFor(hour)).score(samples)  ──┐ │
│      ├─ store score[device][hour], emit ScoreRecorded      │ │
│      └─ accrue reward                         → ERC-20 (sol)│ │
│                                                            │ │
│  QualityScorer (Stylus / WASM, Rust)  ◄────────────────────┘ │
│    score(bytes samples) -> uint256   // pure, no storage     │
│    version() -> bytes32              // crate version + hash │
│                                                              │
│  Staking / Slashing / ERC-20 (existing Solidity, unchanged)  │
└─────────────────────────────────────────────────────────────┘
```

### 1. Restructure the Rust so both builds share one crate

- `scoring-core`: the existing filter/resample/score routine, made `#![no_std]` (plus `alloc` if it uses `Vec`). It has no I/O and no platform code. The firmware pipeline and the Stylus program both depend on it at the **same pinned version and commit**.
- `scoring-stylus`: a thin wrapper, about 50 lines, using `stylus-sdk`. It decodes the ABI `bytes` into the sample struct, calls `scoring_core::score`, and returns the result. It is `#[public]`, stateless, and has no storage.
- Make integer overflow behaviour explicit in the core, with `checked_*`, `wrapping_*` or `saturating_*` everywhere it matters. Release WASM builds and firmware builds can otherwise differ on `overflow-checks`, and a panic in Stylus is a revert. Set `overflow-checks` identically in both release profiles.

### 2. How the reward contract calls the scorer

- Run `cargo stylus export-abi` to generate a Solidity interface (`IScorer`). The reward contract calls the Stylus program like any other contract, through a normal `CALL` with ABI-encoded args. Solidity doesn't know or care that the target is WASM.
- The scorer is a pure function of the samples. Signature checks, staking state, reward accrual and slashing hooks stay in Solidity, where your audited logic already lives. Keep the WASM surface small.
- **Version the scorer per epoch.** Stylus code at an address is immutable, so an upgrade means deploying a new program. Keep `scorerFor(hour)` or `scorerByEpoch[epoch]` in the reward contract, and put scorer changes behind a timelock. That way a dispute over an hour from three months ago replays against the scorer that was live *then*. Scorer changes change payouts, so give them the same governance as a token-contract change.
- **Operator self-check.** `score()` is a view-callable pure function. Any operator can `eth_call` it with their own hour of samples and compare the result to the stored `ScoreRecorded` event. They can also run the same `scoring-core` crate locally and get the identical number. That is the dispute story: one implementation, published and verifiable.

### 3. The real cost is data, not compute

Stylus makes 2k lines of integer DSP cheap to *execute*: roughly 10–100x faster than equivalent EVM code on compute-heavy work. The **gas** saving is much smaller, on the order of 26–50% against optimised EVM, and storage is priced the same as the EVM. What dominates is getting the samples onchain. A few thousand devices × one hour of raw samples × 24/day is calldata, and calldata carries the L1 data-posting cost. Decide between these before you build:

- **(A) Score everything onchain.** Every device's hour of samples goes into `submitHour`, possibly batched by a relayer. This is simplest and strongest, since every score is computed onchain. It is viable if the per-device hourly payload is small, so measure bytes/hour/device and price it on Arbitrum at current fees.
- **(B) Commit, and compute onchain on challenge.** Hourly, your server posts a Merkle root of `(device, hour, sampleHash, score)` per batch. An operator who disputes a score calls `challenge(device, hour, samples, proof)`. The contract checks the samples against the root, runs the *same* Stylus scorer, and corrects the payout (and optionally penalises the poster) if the result differs. Only disputed hours pay for sample calldata, and every score can still be checked against the onchain code.

I'd start with (B) unless (A) is cheap at measured sizes. Either way the Stylus scorer is the same program, so this choice doesn't touch the build.

### 4. Existing Solidity contracts

- They deploy unchanged, but audit **`block.number` use** in staking and slashing (lockups, cooldowns, slashing windows). On Arbitrum, `block.number` returns an approximate **L1** block number, not the L2 block. Anything meant to measure time should use `block.timestamp`.
- If the ERC-20 currently lives on L1 or another chain, decide where it lives. You can mint rewards natively on Arbitrum, or bridge through the canonical Arbitrum token gateway and have the distributor pay out the bridged token. If holders need to go back to L1, note that the canonical exit is an optimistic-rollup withdrawal. It takes three transactions (initiate on L2, then prove and finalize on L1), with a multi-day challenge window you should read live, and nothing finalizes by itself.

---

## What the deploy pipeline must do that a plain Solidity deploy does not

1. **Pinned, reproducible WASM build.** Use `rust-toolchain.toml` with an exact toolchain, `wasm32-unknown-unknown`, a pinned `stylus-sdk`, and a committed `Cargo.lock`. The dispute story depends on anyone rebuilding the exact bytes, so build in the pinned Docker image that `cargo stylus` uses for reproducible builds.
2. **`cargo stylus check` as a CI gate.** It validates that the WASM is a legal Stylus program and fits the **compressed size limit**. 2k lines of integer code will probably fit, but dependencies (formatting, `alloc`, panic machinery) bloat WASM quickly. Strip them: use `panic = "abort"`, avoid `core::fmt` in hot paths, `opt-level = "z"`, LTO, and `wasm-opt`. Fail CI when the size approaches the limit.
3. **Deploy, then activate: two transactions.** The program must be **activated** through the `ArbWasm` precompile before anything can call it, and activation costs a fee in ETH on top of gas. `cargo stylus deploy` does both, but a scripted pipeline (Foundry/Hardhat for the Solidity side) must not wire the scorer's address into `RewardDistributor` until activation has succeeded.
4. **Reactivation monitoring.** Activated programs expire after a period (currently about a year) and may need reactivation after some ArbOS upgrades. A scorer that isn't active makes `submitHour` and `challenge` revert, which stops rewards. Add a scheduled job that reads the program's activation status and expiry from `ArbWasm` and reactivates ahead of time. Put an alert on it. Solidity contracts have no equivalent.
5. **Source verification.** Run `cargo stylus verify` and publish the verified source on Arbiscan, so an operator can go from address to code hash to the git commit of `scoring-core` the firmware also uses.
6. **Cross-target conformance tests.** Maintain a golden corpus of sample hours with expected scores, including edge cases like gaps, saturation and malformed input. CI runs it (a) natively, (b) against the firmware build, and (c) against the deployed WASM on a local Nitro dev node, then on Arbitrum Sepolia. Stock Anvil/Hardhat EVMs don't execute Stylus, so the pipeline needs a Nitro devnode for integration tests. Any mismatch blocks release.
7. **Gas profiling on real payloads.** Measure `score()` gas and `submitHour`/`challenge` calldata cost with max-size hours. Stylus meters in "ink" internally, and gas-per-call must fit comfortably under block gas limits for your largest samples. This profiling is also where option (A) vs (B) gets decided.
8. **Scorer rollout via governance.** New scorer version: deploy + activate, run conformance, queue `setScorer(epoch, addr)` in the timelock, and publish the crate version. Firmware and chain update in lockstep from the same tag.

---

## What would have to change for this to be the wrong choice

- **You become willing to maintain a second implementation, or the scorer shrinks to something trivial.** Without the "one implementation" constraint, Stylus's reason disappears, and chain choice falls back to other constraints: fees, where the token's liquidity and users are, ecosystem. A port to Solidity on any EVM chain would work.
- **The raw data can't or shouldn't go onchain at all.** If sample volume grows by orders of magnitude, or operators' raw data becomes private or commercially sensitive, even challenge-only calldata stops working. Then the better design is **proving** the same Rust in a zkVM (SP1, RISC Zero) offchain and verifying a succinct proof onchain. That keeps one implementation, publishes only a proof and a commitment, and works on *any* EVM chain, including mainnet or wherever your token already lives. It is also the path if you want scores to be final quickly rather than open to challenge.
- **The token must compose with mainnet (or another chain's) liquidity, and the rewards must pay out there.** An Arbitrum scorer then needs a cross-chain message to the payout chain, and it may be simpler to do the zk-proof approach and verify on the payout chain.
- **Holders need fast exits to L1 without trusting a fast bridge.** Arbitrum is an optimistic rollup with a multi-day withdrawal window. If that becomes unacceptable, a ZK rollup fits better, and the Rust would then go through a zkVM proof rather than native execution.
- **The routine stops being deterministic integer code.** Floats, hardware-specific intrinsics, or dependence on wall-clock or device state would break bit-identical onchain/firmware results, and Stylus may not accept the float ops at all.
- **The code outgrows the Stylus program size limit.** You'd have to split it into multiple programs calling each other, and past some point a zkVM becomes the cleaner route.
- **Firmware and chain diverge on purpose,** for example if the firmware scoring becomes a heuristic preview while the "official" score is richer. Then the shared-crate property that justifies Stylus is gone.
- **Stylus stops being a supported, live feature on Arbitrum One,** or its activation/reactivation economics change materially. Recheck this before committing: chain features have been switched off within the last year elsewhere (Polygon zkEVM).
