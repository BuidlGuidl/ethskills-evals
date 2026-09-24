# Onchain scoring for the DePIN network

## Decision: Arbitrum One, with the scoring routine deployed as an Arbitrum Stylus contract

Stylus lets you compile Rust to WASM and deploy it as a normal contract on Arbitrum
chains. It runs in the same state as the EVM, next to your Solidity contracts. The
two sides call each other through ordinary ABI calls. For your constraints, that
matters for three reasons:

- **One implementation.** The same Rust scoring crate compiles into the firmware
  pipeline and into the contract. You aren't porting 2k lines of DSP to Solidity,
  and you aren't keeping two versions in sync.
- **Your math already fits the platform.** Stylus rejects WASM that uses
  floating-point instructions, because they'd be non-deterministic. Your routine
  is integer and fixed-point throughout, which is the kind of code Stylus is
  meant to run. Compute is also much cheaper than the same work in EVM opcodes.
  Filtering and resampling an hour of samples would cost a lot of gas in Solidity.
- **Your Solidity stays as it is.** The ERC-20, staking and slashing contracts
  deploy unchanged to Arbitrum One. If they live on Ethereum L1 or another chain
  today, "keeping" them means redeploying the same source on Arbitrum One and
  bridging or migrating the token. That migration is the real cost of this
  choice, so plan for it up front.

Any operator can dispute a score by calling the deployed scorer with `eth_call`
on their own signed samples. They can also rebuild the contract from source and
check that its codehash matches what's onchain, then run the identical crate
locally. That's the property you want: the device can check its reward against
the same code that pays it.

## What runs onchain

```
workspace/
  scoring-core/      # no_std, no alloc if possible, zero chain deps. THE routine.
  scoring-stylus/    # thin Stylus wrapper: ABI decode -> scoring-core -> ABI encode
  firmware/          # existing pipeline, depends on scoring-core (same commit)
contracts/           # existing Solidity + RewardDistributor changes
```

**`scoring-core`** is your existing routine pulled into its own crate. It must be
`no_std` (at most `alloc`), with no I/O, no time, no randomness and no threads.
Things to clean up while extracting it, because the WASM target can quietly give
different answers from firmware:

- **Pointer width.** `wasm32` has a 32-bit `usize`. If firmware runs on a 64-bit
  target, any arithmetic done in `usize`, or any `as usize` / `as isize` cast of
  intermediate values, can behave differently. Keep all math in explicit `i32` /
  `i64` / `u64` / `i128`.
- **Overflow semantics.** `overflow-checks` differs between debug and release, and
  can differ between the two build profiles. Replace plain `+ - *` on hot values
  with explicit `wrapping_*`, `saturating_*` or `checked_*` so behavior is defined
  in the source, not the profile. Set `overflow-checks = true` in both profiles
  as a backstop.
- **Panics.** A panic in Stylus reverts the call. `scoring-core` should return
  `Result<Score, ScoreError>` for malformed input (too few samples, gaps, bad
  timestamps) instead of panicking. That way the reward contract can decide the
  outcome, such as a zero score or a flagged device, instead of the whole payout
  transaction reverting.
- **Version constant.** `SCORING_VERSION: u32`, bumped on any change to output.

**`scoring-stylus`** is roughly 100 lines using `stylus-sdk`:

```rust
#[public]
impl Scorer {
    /// samples: packed fixed-point samples for one device-hour, as signed by the device
    pub fn score(&self, device: Address, hour: u64, samples: Bytes) -> Result<(u32, u32), Vec<u8>>;
    //                                                               (score, SCORING_VERSION)
    pub fn version(&self) -> u32;
}
```

The scorer is stateless and pure. It holds no balances or registry, so it's easy
to audit and easy to swap per epoch.

**Signature verification** belongs outside the scoring routine, at the point
where samples enter the chain:

- secp256k1 device keys: verify in Solidity with `ecrecover`.
- P-256 device keys, common in secure elements: use the RIP-7212 `P256VERIFY`
  precompile at `0x100`, which Arbitrum has supported since ArbOS 30.

Either way, `scoring-core` stays identical to what firmware runs, which never
verifies its own signatures.

## How the reward contract calls the scorer

Solidity treats the Stylus contract like any other contract. `cargo stylus
export-abi` generates the Solidity interface:

```solidity
interface IScorer {
    function score(address device, uint64 hour, bytes calldata samples)
        external view returns (uint32 score, uint32 version);
}

contract RewardDistributor {
    // scorer per epoch, so historical rewards remain recomputable after upgrades
    mapping(uint256 epoch => IScorer) public scorerForEpoch;

    function submitHour(address device, uint64 hour, bytes calldata samples, bytes calldata sig) external {
        require(!scored[device][hour], "dup");
        _verifyDeviceSig(device, hour, keccak256(samples), sig);  // ecrecover or P256VERIFY
        IScorer s = scorerForEpoch[epochOf(hour)];
        try s.score(device, hour, samples) returns (uint32 sc, uint32 v) {
            scored[device][hour] = true;
            _accrue(device, hour, sc, v);          // feeds existing staking/slashing logic
            emit Scored(device, hour, sc, v, keccak256(samples));
        } catch {
            emit ScoreFailed(device, hour);        // malformed input: no reward, maybe slash path
        }
    }
}
```

The main design choice is data volume. A few thousand devices × 24 hours is
roughly 50–100k scoring calls per day. Compute on Stylus is cheap. Calldata for
an hour of raw samples is what you actually pay for, since it's posted to L1 as
blobs. Pick one of two modes after measuring your real per-hour payload size:

1. **Score everything onchain** (the default if a device-hour is a few KB). A
   gateway or the device batches submissions, and every reward comes from an
   onchain score. This gives the strongest dispute story, because there's nothing
   to dispute.
2. **Optimistic mode** (if payloads are tens of KB or more). Your server posts
   `(device, hour, score, keccak256(samples))` per epoch as a Merkle root, and
   keeps the samples available. During a challenge window, anyone can call
   `challenge(device, hour, samples, proof)`. The contract runs the same Stylus
   `score()` on the real samples, corrects the reward if it differs, and slashes
   or penalizes the poster. The scoring code and the call path are identical, and
   only disputed hours pay for onchain execution.

Either way, the reward contract only ever trusts output from `IScorer`.

## What the deploy pipeline must do beyond a plain Solidity deploy

1. **Reproducible WASM build.** Pin the Rust toolchain (`rust-toolchain.toml`) and
   `cargo-stylus` versions, and build inside the cargo-stylus Docker image. Record
   the resulting WASM hash and the onchain codehash per release. Publish the
   commit and toolchain so operators can run `cargo stylus verify` and get the
   same bytes, and verify the source on Arbiscan. This is the step that makes
   disputes resolvable, so treat a non-reproducible build as a failed build.
2. **`cargo stylus check` as a gate.** It confirms the WASM passes Stylus
   validation: no floats, allowed imports, memory limits. It also checks the size
   limit (about 24 KB after brotli compression by default; check current ArbOS
   parameters). 2k lines of DSP should fit if you:
   - build with `opt-level = "z"`, `lto`, `panic = "abort"`, `codegen-units = 1`
   - run `wasm-opt`
   - avoid heavy dependencies and `core::fmt`
   - use a small allocator such as `mini-alloc`
   
   Track the compressed size in CI so a feature doesn't quietly push it over.
3. **Two-phase deploy: deploy, then activate.** Stylus bytecode is compressed WASM
   with the `0xEFF000` prefix. Before anyone can call it, it has to be
   **activated**: `ArbWasm.activateProgram` at precompile `0x71` compiles it to
   native code on every node and charges an activation fee. `cargo stylus deploy`
   does both steps. If you script your own deploy, activation is a separate,
   paid transaction that must succeed.
4. **Keep the program activated.** Activation expires after about a year, and an
   ArbOS upgrade that bumps the Stylus version can also require reactivation.
   Either way, calls to `score()` revert until you reactivate, which means
   rewards stop. Add a scheduled job that:
   - reads `ArbWasm.codehashAsmSize` / `programTimeLeft` / `programVersion`
     against `ArbWasm.stylusVersion`
   - calls `codehashKeepalive` or reactivates well before expiry
   - pages someone if it's close
   
   Nothing in a Solidity deploy needs this.
5. **Optional cache bid.** Bid into the `CacheManager` so the program stays in
   the node cache. That makes per-call initialization cheaper, which adds up
   across tens of thousands of calls a day.
6. **ABI export and interface drift check.** Generate `IScorer.sol` from
   `cargo stylus export-abi` in CI, and fail if it differs from the committed
   interface the Solidity side compiles against.
7. **Differential test on a replay corpus.** Run a local Nitro dev node in CI.
   Deploy and activate the scorer, then replay a few thousand recorded real
   device-hours (including historically disputed ones) through:
   - `scoring-core` built for the firmware target
   - `scoring-core` native
   - the deployed contract via `eth_call`
   
   Assert byte-identical outputs across all three, and record gas and ink per
   call. This is what backs the claim that there is a single implementation.
8. **Versioned rollout, not in-place upgrade.** Each scoring change is a new
   deployment. Governance or a timelock then calls
   `RewardDistributor.setScorer(epoch, addr)` for a future epoch, and firmware
   with the same `SCORING_VERSION` ships in step. Old scorers stay deployed and
   activated (see step 4) for as long as past epochs can be disputed.

## When this would be the wrong choice

- **The contracts can't move to an Arbitrum chain.** Maybe the token must stay
  on Ethereum L1, or on an OP Stack chain or another chain without Stylus, for
  liquidity, exchange listings or partner reasons. Stylus only runs on Arbitrum
  One, Nova and Orbit chains. You'd then keep the single Rust implementation but
  run it in a zkVM (SP1 or RISC Zero) offchain, and verify a proof on whatever
  chain the contracts live on.
- **Raw samples must stay private.** Stylus re-execution requires publishing
  inputs. If measurements become commercially or personally sensitive, you need
  ZK proofs over private inputs. The same zkVM route applies.
- **Data outgrows posting.** This covers higher sample rates, much larger
  devices-per-hour counts, or imagery or audio instead of scalar readings. Even
  the optimistic mode needs a challenger to post a full device-hour in one
  transaction. Past that point, proofs that are cheap to verify onchain beat
  re-execution.
- **Scoring stops being small, integer and per-device.** Floats, ML models, or
  multi-MB lookup tables break the Stylus size, memory and float constraints.
  So does scoring that depends on network-wide state each hour, such as ranking
  every device against its peers or percentile normalization across thousands of
  devices. That becomes a batch computation, not a per-device call, and it fits a
  proven offchain computation better.
- **Scoring must also run in firmware that can't share the crate.** If the
  firmware moves off Rust, or needs floats or a different algorithm, the
  "one implementation" premise is gone. So is the main reason to prefer Stylus
  over a plain Solidity port.
- **Disputes become rare and low-stakes.** Then publishing the crate and a signed
  data commitment per hour, with offchain re-scoring, may be enough without the
  Arbitrum dependency and without the activation and keepalive work.
- **You're unwilling to accept Arbitrum's trust and operations model.** This
  includes Arbitrum governance controlling ArbOS upgrades (which can force
  reactivation), the sequencer, and the 7-day L1 withdrawal delay. If those
  aren't acceptable for a rewards token, Stylus isn't the right platform.
