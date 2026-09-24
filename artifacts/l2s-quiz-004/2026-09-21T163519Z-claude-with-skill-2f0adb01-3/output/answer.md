# Onchain scoring for the DePIN reward system

## Where to deploy: Arbitrum One, scoring as a Stylus contract

You have two constraints that decide this:

1. **You won't keep two copies of the scoring routine.** The routine is 2k lines of integer-only Rust that the firmware pipeline also runs. Rewriting it in Solidity would create exactly the second copy you refuse to maintain. It would also cost far too much gas: filtering and resampling an hour of samples in the EVM means millions of gas per device per hour.
2. **Your Solidity reward, staking and slashing contracts stay as they are.** The scorer has to be callable from those contracts, in the same transaction, just like any other contract.

**Arbitrum Stylus** meets both. It runs WASM next to the EVM on Arbitrum chains, and both share the same state and the same call ABI. You compile your existing Rust crate to `wasm32-unknown-unknown`, deploy it, and get a contract address. Solidity calls it through a normal interface. Compute-heavy code like yours typically costs 10–100x less gas under Stylus than the same logic in Solidity. Integer-only math is what makes this work: WASM integer arithmetic is fully deterministic, and there are no float edge cases to worry about.

Deploy on **Arbitrum One (chain 42161)**. The reward contracts must be on the same chain as the scorer so the call is synchronous. If the ERC-20, staking and slashing contracts live on another chain today, they move to Arbitrum One. They redeploy unchanged with standard `solc`/Foundry (see the `block.number` caveat below). The token can be bridged back to mainnet if you need liquidity there.

## What runs onchain

```
scoring-core/        # no_std Rust crate: the routine. ONE copy. Firmware + server + onchain all depend on it.
scoring-stylus/      # thin Stylus wrapper: ABI in/out, calls scoring-core. ~100 lines.
contracts/           # your existing Solidity: ERC20, Staking, Slashing, + Rewards changes below
```

- **`scoring-core`** is the existing routine, pulled out into its own crate if it isn't one already. Make it `#![no_std]`, and use `alloc` only if you actually need it. It must not depend on anything platform-specific. The firmware build, the server and the Stylus wrapper all use it as a path or git dependency pinned to the same commit. This is what keeps it to a single implementation.
- **`scoring-stylus`** is a `stylus-sdk` contract with one entry point. It takes no storage, so it is a pure function onchain:
  ```rust
  #[public]
  impl Scorer {
      pub fn score(&self, device: Address, hour: u64, samples: Bytes) -> Result<U256, Vec<u8>> {
          let s = scoring_core::decode(&samples).map_err(|e| e.to_bytes())?;
          Ok(U256::from(scoring_core::score(&s)))
      }
      pub fn version(&self) -> [u8; 32] { SCORING_CORE_GIT_COMMIT }
  }
  ```
  If device signatures are ed25519, or any curve other than secp256k1, verify them inside this wrapper using the same Rust crate the firmware uses. That is much cheaper than doing it in Solidity. For secp256k1 you can call `ecrecover` from either side.
- **Solidity reward contract.** Run `cargo stylus export-abi` to generate an `IScorer` interface, then call it:
  ```solidity
  uint256 q = IScorer(scorer).score(device, hour, samples);   // STATICCALL into WASM
  ```

### How data gets onchain: commit every hour, score onchain when challenged

Estimate your data volume before you commit to scoring every submission onchain. The rough load is `devices × 24 × bytes_per_hour`. For example, 3,000 devices × 24 × 10 KB is about 720 MB of calldata per day. On Arbitrum you pay L1 data-availability cost for every byte, and at that size calldata costs far more than the Stylus compute. So I recommend this flow:

1. **Every hour:** each device, or a relayer for it, submits `keccak(signed samples)`. Your server publishes the scores for that epoch as a Merkle root of `(device, hour, score, samplesHash)`. Onchain cost is a few hundred bytes per epoch. The raw samples stay with the device and in your storage (or IPFS or blobs).
2. **Anyone can check a score for free.** A device operator runs `eth_call` on `scorer.score(device, hour, samples)` against the deployed contract and compares the result with the published leaf. No gas, no trust in your server, and the code that runs is exactly the onchain code.
3. **Disputes, within a challenge window:** the operator submits the raw samples. `Rewards` checks them against `samplesHash` and the device signature, then calls the Stylus scorer, which is the authoritative score. If the result differs from the published score, the reward is corrected from the scorer's output, and a bond is slashed from the publisher (your existing slashing contract) or the challenger gets a bounty.
4. **Payout** happens after the window closes, by Merkle claim, using your existing reward logic.

If your real payload is small, say under about 1 KB per device-hour, skip the optimistic layer. Just call `score()` on every submission and pay out directly; the contract layout above doesn't change. Either way, the only thing that decides a disputed score is the Stylus contract.

### Versioning

Make the scorer **immutable per version**, with no proxy in front of it. `Rewards` stores `scorerFor[epoch]`, and switching to a new scorer address goes through a timelock. Every score can then be traced to an exact git commit (`version()`), and that commit is the same one the firmware pipeline shipped. Operators can dispute against the scorer that was actually in force for that hour.

## What the deploy pipeline has to do beyond a Solidity deploy

1. **Deterministic cross-target build discipline for `scoring-core`.**
   - wasm32 has a 32-bit `usize`, and your server is probably 64-bit. Ban `usize` in scoring arithmetic and use explicit `u32`/`i64` types.
   - Overflow behaves differently in debug and release builds. Use explicit `wrapping_*`/`checked_*`/`saturating_*` operations, or set `overflow-checks` identically in every profile.
   - A panic in Stylus becomes a revert. Decide how malformed input should behave (a zero score or a revert) and make every target do the same thing.
   - In CI, run one golden test vector set (real device-hours paired with expected scores) against three builds: native, the firmware target, and the WASM running in a local Stylus devnode (`nitro-devnode`). CI fails if any of them disagree by even one bit.
2. **Size and validity check: `cargo stylus check`.** The Brotli-compressed WASM has to fit the 24 KB contract-size limit, and the uncompressed WASM has its own cap of about 128 KB. 2k lines of integer code fits comfortably as long as you keep `core::fmt`, panic message strings and `std` out of the build: use `opt-level = "z"`, `lto = true`, `panic = "abort"`, `codegen-units = 1`, and `wasm-opt`. Put the size check in CI so a firmware-driven change can't silently break the onchain deploy.
3. **Deploy and then activate.** Deploying the code is not enough. The program must also be **activated** through the ArbWasm precompile (`0x…0071`, `activateProgram`), which is payable and charges a data fee. That step compiles the WASM to native code on the nodes. `cargo stylus deploy` does both. If you script the deploy yourself, you have to do both steps, and until activation the contract can't be called.
4. **Reproducible, verifiable builds.** The whole point is that operators can trust the onchain code, so publish a verified build. Run `cargo stylus deploy`/`verify` in the pinned Docker toolchain (reproducible mode), verify on Arbiscan, and record `{git commit, rust toolchain, stylus-sdk version, codehash}` in the release. Any operator should be able to rebuild from the tagged commit and get the same codehash.
5. **Activation lifecycle monitoring.** Activations expire (currently about 365 days), and some ArbOS upgrades raise the Stylus version and require reactivation. Add a scheduled job that watches `ArbWasm.programTimeLeft` and `codehashVersion` and calls `codehashKeepalive` or reactivates in time. A lapsed scorer would stop all disputes and payouts. Solidity contracts have no equivalent failure mode.
6. **Optional: cache bidding.** For a contract called thousands of times an hour, bid for a slot in Arbitrum's program cache with `cargo stylus cache bid`. That removes the cold-load cost from each call.
7. **Gas limits.** Measure a worst-case hour, with the largest sample count and the ugliest filter path, on the devnode. Make sure a dispute call stays well under Arbitrum's per-transaction gas limit. Stylus also charges for WASM memory pages, so keep the working buffers bounded.
8. **Solidity contracts: one audit item.** On Arbitrum, `block.number` returns an approximate **L1** block number, not the L2 block number. If staking, slashing or epoch logic keys off `block.number`, switch it to `block.timestamp` (or `ArbSys.arbBlockNumber()`) before you redeploy.

## What would make this the wrong choice

Stylus is right because of four facts about your product: the scorer is deterministic single-device integer Rust, it has to be *synchronously callable* by your own Solidity contracts, disputes arrive one device-hour at a time, and you're free to choose the chain. If any of these changes, the answer changes:

- **The rewards have to live on a chain without Stylus**, such as mainnet, Base or OP, because that's where the token, liquidity or partners are. Stylus only exists on Arbitrum One/Nova and Arbitrum Orbit chains. Then use a **zkVM (SP1 or RISC Zero)**. It runs the same `scoring-core` crate unchanged and posts a proof that your Solidity contract checks through a verifier contract on any EVM chain. You would take on proving infrastructure, proving cost per scored batch, and latency.
- **You want every device-hour scored and settled onchain, and the raw data is large.** Posting the raw samples then costs more than anything else. The zkVM becomes the better option: prove "these N device scores are correct for these committed samples" offchain and post one proof per epoch, so no raw data ever goes onchain. At much higher volume, an **Arbitrum Orbit L3** with Stylus and cheap or AnyTrust data availability is another option, at the price of running your own chain.
- **Raw samples become private**, for example location or customer data. Replaying samples onchain in a dispute publishes them. A zk proof does not.
- **Scoring becomes cross-device**: neighbor consensus, network-wide normalization, or outlier detection across thousands of devices. Then a single call needs the whole network's data and would blow past any per-transaction gas budget. That requires offchain compute with a validity proof (zkVM), or an interactive fraud proof.
- **The routine outgrows the Stylus size limits**, a lot more code or large lookup tables, and can't be split across contracts cleanly. The zkVM has no equivalent limit.
- **The routine stops being deterministic integer math**, for example floats or ML inference. Floats are deterministic within WASM itself, but your guarantee is bit-exactness *with firmware*, and it breaks the moment firmware and WASM round differently. That hits every option equally, but it removes the "same code everywhere" argument that made Stylus appealing.
- **You're willing to maintain two implementations after all.** Then a Solidity scorer on any EVM chain becomes possible, but only if the routine is small enough to fit the EVM gas budget. At 2k lines of filtering and resampling, it probably isn't.
