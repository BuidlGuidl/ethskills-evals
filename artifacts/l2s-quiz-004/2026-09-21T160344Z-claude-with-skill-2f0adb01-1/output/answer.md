# Onchain scoring for the DePIN network

## Decision: Arbitrum One, with the scorer as a Stylus contract

Deploy the whole reward stack on **Arbitrum One**. Compile the existing Rust scoring routine to WASM as an **Arbitrum Stylus** contract, and have your Solidity reward contract call it.

This is the only L2 option that meets all three of your constraints at once:

1. **One implementation.** The Rust crate your firmware pipeline runs is the crate that runs onchain. You don't port it to Solidity, and you don't keep a second copy.
2. **Your Solidity stays.** Stylus runs next to the EVM on the same chain, with the same state and the same addresses. Calls between Solidity and Stylus contracts are ordinary `CALL`s in both directions. The ERC-20, staking and slashing contracts redeploy unchanged, because Arbitrum is EVM-equivalent with no compiler changes.
3. **It's affordable.** Filtering and resampling an hour of samples is heavy integer compute. In the EVM that would cost far too much. Stylus meters WASM compute at roughly 10–100x less gas than the equivalent EVM code. Fixed-point integer math with no floats is the ideal workload for it.

Every other major L2 (Base, OP Mainnet, Scroll, Linea, zkSync) runs only EVM bytecode. On those chains you would either rewrite 2k lines in Solidity or leave the chain to prove the computation somewhere else (see the last section).

---

## What runs onchain

```
                          Arbitrum One
 ┌──────────────────────────────────────────────────────────────┐
 │  ERC20 (existing)   Staking (existing)   Slashing (existing) │
 │          ▲                 ▲                    ▲            │
 │          └──────── RewardDistributor (Solidity) ┘            │
 │                    │  - epoch commitments                    │
 │                    │  - posted scores / Merkle root          │
 │                    │  - dispute + recompute path             │
 │                    ▼                                         │
 │            IScorer (Solidity interface)                      │
 │                    │  plain CALL                             │
 │                    ▼                                         │
 │         Scorer  (Stylus / WASM, Rust)                        │
 │           pure fn score(samples, params) -> (score, digest)  │
 └──────────────────────────────────────────────────────────────┘
```

### Crate layout (how you avoid a second implementation)

```
scoring-core/      #![no_std] + alloc. The existing 2k-line routine, unchanged.
                   No I/O and no chain awareness. Firmware, server and chain all depend on it.
scoring-stylus/    A thin wrapper of about 100 lines. stylus-sdk entrypoint: decode the ABI,
                   call scoring_core::score, encode the result. Nothing else.
firmware/, server/ Existing consumers, now depending on scoring-core.
```

Keep the Stylus wrapper **stateless and pure**. It takes samples plus parameters and returns a score and a digest of the input. All storage, money movement and policy stay in Solidity, which you already audit and understand. The Rust side then has almost no onchain attack surface: it is just a function.

### Data path: commit every hour, compute when disputed

Posting every device's raw hour onchain every hour costs real money: a few thousand devices × hourly × (samples × bytes) of calldata, with L1 data fees on every byte. You also don't need to do it, because the samples are already device-signed. The design I recommend:

1. **Every hour (the cheap path).**
   - Your server posts one transaction per epoch with a Merkle root of `(device, hash(signed samples))`, a Merkle root of `(device, score)`, and the scorer version.
   - Devices also publish their own sample hashes, or co-sign the leaf, so the server can't substitute data.
   - Rewards are claimable against the score root after a challenge window. A few hours is plenty; this is your own window, not Arbitrum's 7-day bridge window.
2. **On dispute (the Stylus path).**
   - The operator calls `RewardDistributor.dispute(epoch, device, samples, proofs)`.
   - Solidity checks the samples against the committed hash, and checks the device signature if the samples aren't already bound by the commitment.
   - Solidity calls `IScorer(scorer).score(samples, params)` and compares the result to the posted score.
   - If they differ, the recomputed score replaces the posted one and your existing slashing/penalty logic applies to whoever posted the wrong score.
3. **Self-check (free).** A device or operator can `eth_call` the scorer with its own samples at any time and pay nothing. That lets them check their own reward: the result is exactly what the chain would enforce, from the same bytes the firmware ran.

If your hourly payload per device is small (a few KB), you can skip the optimistic layer and score every device onchain every hour. That is simpler, and the architecture is the same: the only change is that `RewardDistributor` calls the scorer on every submission instead of only on disputes. Measure calldata per device-hour before you decide. Keep the dispute design as the default at "thousands of devices".

**Signatures.** If devices sign with secp256k1, use `ecrecover`. If they use P-256 (common in secure elements), Arbitrum has the RIP-7212 `P256VERIFY` precompile at `0x100`. Call it from Solidity or from Stylus. Don't verify signatures in hand-rolled Rust. If devices use Ed25519, there's no precompile. Verify it in Stylus with a `no_std` crate, and budget gas for it.

### How the reward contract calls the scorer

1. Run `cargo stylus export-abi` to generate the Solidity interface from the Rust wrapper. Commit it into the Solidity repo.

   ```solidity
   interface IScorer {
       function score(bytes calldata samples, bytes calldata params)
           external view returns (uint64 score, bytes32 inputDigest);
       function version() external view returns (uint32);
   }
   ```

2. `RewardDistributor` stores `mapping(uint32 version => address scorer)` and records the active version in each epoch's commitment. Stylus code is immutable at its address. Upgrading therefore means deploying a new program and registering it through a timelocked governance call. A dispute over epoch *N* always re-runs the scorer that was active in epoch *N*, so later upgrades never change past rewards.
3. Use `staticcall` with an explicit gas cap and handle reverts. A malformed sample blob from a disputer must fail that dispute, and must never brick the distributor.
4. Use `block.timestamp` for epochs, never `block.number`. On Arbitrum, `block.number` returns the L1 block number.

---

## What your deploy pipeline needs beyond a plain Solidity deploy

| # | Step | Why a Solidity deploy doesn't need it |
|---|------|---------------------------------------|
| 1 | **Pin the Rust toolchain** (`rust-toolchain.toml`), add the `wasm32-unknown-unknown` target, install a pinned `cargo-stylus`. | `solc` is a single versioned binary; here the whole Rust toolchain determines the bytecode. |
| 2 | **Make the WASM fit.** The compressed (brotli) program must be under the ~24 KB code limit, and the uncompressed size is capped too. Build with `opt-level = "z"`, `lto = true`, `panic = "abort"`, `codegen-units = 1`, then run `wasm-opt`. Strip `core::fmt` from panic paths. Fail CI on a size budget with headroom. | EVM size limits are well known and rarely hit at this size. 2k lines of Rust fits, but only if you watch it. |
| 3 | **`cargo stylus check`** against the target chain. It validates the WASM (allowed imports, memory, no disallowed instructions) before you spend gas on the deploy. | No equivalent step. |
| 4 | **Deploy in two steps: deploy, then activate.** After the code is deployed, call `ArbWasm.activateProgram(addr)` at precompile `0x…0071` and pay the activation data fee in ETH. Calls to an unactivated program revert. `cargo stylus deploy` does both; if you script the deploy yourself, make activation a required step that is checked. | A Solidity contract is callable as soon as its creation tx lands. |
| 5 | **Keep the program active.** Activation expires, currently after about 365 days, and some ArbOS upgrades require reactivation. Run a scheduled job that checks `ArbWasm.programVersion` / `codehashKeepalive` and reactivates in time. Alert well before expiry. | Solidity bytecode never expires. |
| 6 | **(Recommended) Bid for the program cache.** Use `cargo stylus cache bid` on the CacheManager. Hot programs skip the per-call initialization cost, and a scorer called every epoch or dispute is exactly that case. | No equivalent step. |
| 7 | **Reproducible build and verification.** Build in the pinned Docker image that `cargo stylus` uses, publish the source, and verify it (`cargo stylus verify` or Arbiscan's Stylus verification). Then an operator can independently confirm that the onchain codehash came from the same `scoring-core` commit as the firmware. This is the whole point of the project. | Etherscan verification of `solc` output is a routine step. |
| 8 | **Parity tests on a real Nitro node.** Anvil and Hardhat do not execute Stylus. Run `nitro-devnode` (or Arbitrum Sepolia) in CI. Feed a corpus of recorded real device-hours plus fuzzed edge cases to (a) the native `scoring-core` build, (b) the firmware target build, and (c) the deployed Stylus contract via `eth_call`, and require bit-identical outputs. Stop the release if they differ. | Foundry fork tests cover everything for a pure-Solidity system. |
| 9 | **Audit portability in `scoring-core`.** WASM is 32-bit, so `usize` is 32 bits. Find any `usize` arithmetic that assumes 64-bit and switch it to explicit `u64`/`i64`. Set `overflow-checks` identically in every profile, or use explicit `wrapping_`/`checked_` operations. Otherwise debug builds on the server and release builds onchain can diverge on overflow. Put the fixed-point format in one place. | Not applicable. |
| 10 | **Gas budget per call.** Benchmark the gas for the worst-case (largest valid) device-hour. Store the cap in `RewardDistributor` and make it a checked constant in CI. | You'd benchmark Solidity too, but here the compute side is what dominates. |
| 11 | **Versioned rollout.** Deploy program → activate → cache → verify → parity test against the live address → timelocked `registerScorer(version, addr)` → first epoch using it. | A Solidity upgrade is usually "deploy + point proxy". |

**Migrating the existing contracts.** If the ERC-20, staking and slashing contracts live on another chain today, they have to move to Arbitrum or be bridged there, because the scorer must be synchronously callable by the contract that pays and slashes. Solidity contracts redeploy unmodified. If the token must stay canonical on L1, bridge it through the Arbitrum token gateway and run staking and rewards on Arbitrum. Keep in mind that L2→L1 withdrawals through the canonical bridge take about 7 days.

---

## What would make this the wrong choice

Stylus is right because of one specific combination: the scoring must be *executed* by a contract, from the exact Rust source, on the same chain as Solidity contracts you're keeping, with inputs small enough to put onchain on demand. Change any of these and the answer changes:

1. **The rewards must live on a chain other than Arbitrum.** Examples: the token's liquidity and users are on Base or mainnet, a partner requires a specific chain, or you want the fastest finality a ZK rollup offers. Then use a **zkVM coprocessor** instead: SP1 or RISC Zero. `scoring-core` compiles into the guest program unchanged (it's `no_std` integer Rust, which is ideal), the prover runs offchain, and your Solidity contract verifies a succinct proof on any EVM chain. You still keep a single implementation. What you give up is a local `eth_call` self-check (operators re-run the guest locally instead), and you take on proving cost and a prover dependency.
2. **The data gets big.** Examples: higher sample rates, many sensors per device, or a need to score every device every hour. Once even a single disputed device-hour no longer fits in a transaction within gas limits, or scoring everything onchain costs more than the rewards are worth, a zk proof wins, because it compresses any amount of input into a constant-size proof. Another option is an Arbitrum Orbit L3 where you control gas limits and pricing.
3. **The routine stops being small, deterministic integer code.** Examples: floats, an ML model, or growth well beyond the ~24 KB compressed WASM limit. Stylus is a bad host for large or nondeterministic workloads; a zkVM handles large deterministic ones, and nothing onchain handles nondeterministic ones.
4. **Sample privacy becomes a requirement.** Examples: location data, or customer-sensitive measurements. A dispute on Stylus publishes raw samples in calldata forever. A zk proof can attest to the score without revealing the samples.
5. **The firmware routine stops being the source of truth.** If scoring moves to a server-side model that is no longer shared with the device pipeline, the "no second implementation" constraint that drives this choice goes away. A Solidity scorer, or a simpler signed-oracle design with an optimistic challenge, might then be enough.
6. **You aren't willing to depend on Arbitrum-specific machinery.** Stylus ties you to ArbOS: activation, reactivation, cache bidding, and Nitro-only testing. If portability across EVM chains matters more to the business than cheap native execution, choose the zkVM route from item 1.
7. **Disputes stop being the problem.** If operators start trusting the published scores and disputes become rare, a signed attestation with published source and reproducible builds may be enough, and the onchain scorer is complexity you don't need.

In short: as long as the product is a few thousand devices, integer scoring code shared with firmware, rewards in Solidity you're keeping, and inputs that fit in a transaction on dispute, use Arbitrum with Stylus. Once the data, the chain, or privacy requirements outgrow that, move to a zkVM proving the same crate.
