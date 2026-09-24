# Onchain scoring for the DePIN network

## Where to deploy: Arbitrum One, with the scorer as a Stylus program

The deciding constraint is that you won't maintain a second implementation of a 2k-line Rust routine. That rules out every EVM-only chain, because on those the scorer would have to be rewritten in Solidity (or Yul) and kept in lockstep with firmware forever. That's the exact thing you said you won't do.

Arbitrum Stylus runs Rust compiled to WASM next to the EVM, on the same chain and the same state. Solidity can call a Stylus program as a normal contract, and the program can call back. So:

- The scoring crate your firmware pipeline already uses gets compiled to `wasm32-unknown-unknown` and deployed as-is. Only a thin wrapper is new.
- Your ERC-20, staking and slashing contracts stay in Solidity. On an optimistic rollup they deploy with the same bytecode as mainnet: change the RPC URL and chain id and they deploy unchanged.
- Your code has no floats and uses fixed-point integers throughout. That's what you want for consensus execution: results are deterministic and bit-identical between the device build and the onchain build. It also avoids any trouble with float opcodes in the WASM (Stylus is built around deterministic integer execution).

Keep the two performance claims separate. Stylus is roughly **10–100x faster** on compute-heavy work like filtering and resampling. The **gas** saving over well-optimized EVM code is much smaller, around 26–50%, and storage costs the same as in the EVM. The real gain here isn't cheaper gas. It's that the routine that sets the reward is the same routine the operator can run.

## What runs onchain

```
 device ──signed hourly samples──▶ submitter (you, or the operator)
                                        │ tx: submit(deviceId, hour, samples, sig)
                                        ▼
  ┌──────────── RewardManager (Solidity, yours) ─────────────┐
  │ 1. check device is registered + staked  (Staking.sol)    │
  │ 2. verify device signature over keccak(samples, hour)    │
  │ 3. score = IScorer(scorer[epoch]).score(samples)  ───────┼──▶ Scorer (Stylus / Rust→WASM)
  │ 4. record score, accrue ERC-20 reward                    │     same crate as firmware
  │ 5. emit Scored(deviceId, hour, samplesHash, score, ver)  │     pure function, no storage
  └──────────────────────────────────────────────────────────┘
```

- **Scorer (Stylus).** A stateless program that exposes one pure function, e.g. `score(bytes samples) -> uint32` (or a fixed-point `uint64`), plus `version() -> bytes32`, which returns the git commit or crate hash of the scoring code. It holds no storage, no owner and no upgrade hook. Changing the scoring means deploying a new program.
- **RewardManager (Solidity).** Calls the scorer through an ordinary Solidity interface. `cargo stylus export-abi` generates that interface from the Rust `#[public]` impl, so the ABI comes from the Rust code and you don't write it by hand. The reward contract keeps `scorer[epoch]` → address, so a scoring change only applies from a stated epoch and old device-hours can still be re-scored with the code that was live then.
- **Signature check.** If device keys are secp256k1, verify in Solidity with `ecrecover`. If firmware signs with ed25519 (common on embedded devices), do the verification in the Stylus program with the same Rust crate the backend uses today. It's cheap there and expensive in the EVM.
- **Staking/slashing.** Unchanged. Slashing can now depend on facts the chain verified itself, e.g. no submission for the hour, or a signature over two conflicting sample sets for the same hour.

**How an operator checks their reward.** The raw samples are in calldata, and the `Scored` event includes their hash. An operator takes their own samples and makes an `eth_call` to `score()` at the block in question: it's free, needs no transaction, and returns the identical integer. They can also run the same crate natively, since the program's `version()` is the commit hash. A dispute then comes down to "are these the samples my device signed?", which the signature settles, not "is your server's code the code you claim". Most of today's disputes should go away because of that.

**The main cost is data, not compute.** A few thousand devices × 24 hours/day comes to tens of thousands of scoring calls a day. On an L2, the cost of each call is mostly the calldata for an hour of raw samples, which gets posted to L1. Before committing, measure the bytes per device-hour and price a worst-case hour on Arbitrum One at current fees. If raw samples are large, use this variant:

- *Commit and challenge.* The submitter posts `(deviceId, hour, samplesHash, claimedScore)` along with the signature. Anyone can call `challenge(deviceId, hour, samples)` during a window. That call re-runs the **same Stylus scorer**, checks the samples against the hash, and slashes the submitter's stake if the score is wrong. You still have one implementation. It just only runs onchain when someone disputes. Because operators dispute constantly today, start with scoring every submission and move to this only if the calldata bill forces it.

## What the deploy pipeline must do beyond a Solidity deploy

1. **Split the crate.** Put the scoring logic in a `no_std` + `alloc` core crate with no Stylus dependency. The firmware pipeline and a thin `stylus-sdk` wrapper crate both depend on it, and both builds come from the same commit.
2. **Equivalence gate in CI.** Run a golden corpus of real device-hours, including edge cases (gaps, saturation, overflow boundaries, empty hours), through the native build and the WASM build, e.g. with `cargo stylus` local testing or a WASM runtime. Require bit-identical scores. Fail the build on any difference, and on any float instruction showing up in the WASM.
3. **Size and compile checks.** Build `--release` with size optimizations (`opt-level = "z"`/`"s"`, LTO, `panic = "abort"`, stripped). Run `cargo stylus check` against the target chain, because Stylus programs have a compressed-size limit. A 2k-line routine should fit, but a heavy dependency such as a formatting library or a full ed25519 stack can push it over. Watch it on every PR.
4. **Reproducible build.** Build in the pinned Docker toolchain that `cargo stylus` uses, and publish the source so `cargo stylus verify` (and Arbiscan verification) can tie the deployed WASM to your commit. That verification is what makes the "check it yourself" promise believable.
5. **Deploy, then activate.** A Stylus program can't be called until it's activated in a separate onchain transaction through the `ArbWasm` precompile, which charges an activation fee in ETH. `cargo stylus deploy` does both steps. If you script deployment yourself, it needs two transactions, and it should assert that activation succeeded before wiring the address into `RewardManager`.
6. **Gas profiling.** Measure `score()` gas on the worst-case hour of samples and set submitter gas limits from that number. Estimates for "typical" hours will fail at the tail.
7. **Wiring and versioning.** Register the new scorer under a future epoch in `RewardManager`, done through your timelock or multisig. Record `version()` = commit hash onchain and announce it before it takes effect, so operators can re-run the code first.
8. **Keeping the program activated.** Activation isn't permanent. ArbOS upgrades that bump the Stylus version, and the program-expiry parameter, can require **reactivation** (`ArbWasm.codehashKeepalive` / re-activate). Add a monitored job that reads `ArbWasm` for the program's status and expiry and reactivates in time. Every scorer address still referenced by an open dispute window needs this. Read the current expiry parameter off `ArbWasm`; don't hardcode it.
9. **Solidity contracts.** If your ERC-20, staking and slashing are already on Arbitrum One, nothing changes. If they're on L1 or another chain, you need to choose: move reward accounting to Arbitrum (the token can stay on L1 and bridge through Arbitrum's canonical gateway), or relay scores cross-chain. Relaying adds a messaging layer and a trust assumption, so avoid it if you can.

Before this becomes a commitment, check on Arbitrum's docs and chain that Stylus is live on Arbitrum One mainnet with the SDK version you target, and read the current size limit, activation cost and expiry values live.

## What would make this the wrong choice

- **You'd accept a second implementation.** The whole case for Stylus is not rewriting the scorer. If a Solidity port plus a differential-testing harness becomes acceptable, pick the chain on other grounds: where the token's liquidity is, consumer reach (Base), or fast L1 exit.
- **The data gets too big to post.** If an hour of raw samples grows past what's reasonable to put in calldata (high-rate sensors, many more devices, much finer windows), re-executing the routine onchain stops paying off. The better design is then to **prove** the same Rust routine offchain in a zkVM (RISC Zero, SP1) and verify one succinct proof per batch onchain. That still means one implementation, and the verifier can live on any chain. It's also the right move if you need to batch all devices into one proof per hour.
- **The samples have to stay private.** Stylus re-execution means the raw measurements are public calldata. If operator data becomes commercially sensitive or regulated, you'd need a ZK proof over committed data instead.
- **The reward system has to live somewhere else.** If the token has to compose with mainnet liquidity, or the protocol commits to another L2 for ecosystem reasons, then scoring on Arbitrum means a cross-chain message for every settlement. Keeping everything on one chain would then outweigh the Stylus advantage, pushing you back to a port or to a zk proof verified on that chain.
- **Devices or operators must pay gas themselves and hold no ETH.** If the product moves to devices submitting directly with no gas-token balance, native account abstraction (zkSync Era) or stablecoin gas (Celo, CIP-64) becomes the binding constraint. You'd also be back to a port or a zk proof, because neither chain runs your Rust.
- **Operators need fast exits to L1.** Arbitrum is an optimistic rollup. Withdrawing rewards to L1 means a multi-day challenge window plus prove/finalize steps, unless operators use a fast bridge and accept its trust assumption. If a native, fast L1 exit becomes a product requirement, a ZK rollup is the better fit, and again the scoring would need a proof, not re-execution.
- **The scoring stops being deterministic integer math.** If the routine picks up floats, randomness or external data such as weather or peer comparisons pulled offchain, it can't be re-executed bit-identically onchain. You'd need an oracle or a proof over committed inputs.
- **The disputes stop.** If operators come to trust the published scoring, e.g. because you open-source it and publish signed per-hour inputs, the reason for running it onchain weakens. A cheaper design would publish the inputs and a hash of the code and keep scoring offchain.
