# Recommendation

Deploy the reward system on **Arbitrum One**, and put the scoring routine in an
**Arbitrum Stylus Rust contract**. Keep the ERC-20, staking, slashing, registry,
and reward accounting contracts in Solidity.

That is the right fit because your hardest constraint is not generic cheap gas;
it is that the scoring routine already exists in Rust, is deterministic, uses
fixed-point integer math, and must not be reimplemented in Solidity. Stylus lets
that Rust code compile to WASM and live at a normal Arbitrum contract address,
while Solidity contracts can call it through an ABI interface like any other
contract. Base, Optimism, Scroll, or mainnet would all force either a second
Solidity implementation, a server/oracle result, or a zk proof system around the
Rust program. Those are worse fits for the product as described.

# What Runs Onchain

## Stylus Rust Scoring Contract

Move the existing scoring routine into a shared Rust crate, for example:

```text
crates/scoring-core/        # shared deterministic scoring library
crates/scoring-stylus/      # thin Stylus ABI wrapper
firmware/                  # uses scoring-core too
```

`scoring-core` should contain the real algorithm: filtering, resampling,
fixed-point math, bounds checks, and the final score calculation. The Stylus
contract should be a thin adapter around it:

```solidity
interface IQualityScorer {
    function scoreHour(
        bytes32 deviceId,
        uint64 hour,
        bytes calldata rawSamples,
        uint32 configVersion
    ) external view returns (uint32 score, bytes32 traceHash);
}
```

The scoring contract should be deterministic and mostly stateless. If the
algorithm has tunable parameters, put them behind explicit `configVersion`s and
include the config hash in events. The important invariant is that a device,
operator, indexer, and contract all agree on exactly which code and config
scored a given hour.

Do not permanently store raw samples unless the business truly needs that. Use
the raw samples as calldata to the claim/scoring transaction, store the resulting
score and `keccak256(rawSamples)`, and emit enough event data for auditability.
That keeps the reward path verifiable without making telemetry storage the main
cost center.

## Solidity Reward Contract

The existing Solidity reward contract becomes the coordinator. A typical claim
flow should be:

1. Operator or device submits `claim(deviceId, hour, rawSamples, deviceSig)`.
2. Solidity verifies the device signature over a domain-separated message:
   chain id, reward contract address, device id, hour, samples hash, and config
   version.
3. Solidity checks registry/staking/slashing state and rejects duplicate claims.
4. Solidity calls `IQualityScorer.scoreHour(...)` on the Stylus contract.
5. Solidity converts the score into a token reward using the existing reward
   formula.
6. Solidity records the finalized score/reward for `(deviceId, hour)`, pays or
   accrues the ERC-20 reward, and emits `HourScored`.

From the reward contract's point of view, the scorer is just another external
contract. The only special part is deployment and testing; runtime integration is
normal ABI calls.

For disputes, the answer should be boring: anyone can replay the same calldata
against the onchain scorer with `eth_call`, compare the stored score, and see the
exact scorer version/config used for that hour. That is the product win.

# Build And Deploy Pipeline

A plain Solidity deploy is not enough. The pipeline needs to build and prove
compatibility across Solidity, Rust, WASM, firmware, and onchain gas limits.

Required pipeline steps:

1. Pin the Rust toolchain, Cargo dependencies, Solidity compiler, and config
   files. Treat scorer code changes like consensus changes.
2. Run the Rust scorer test suite on native Rust with golden vectors taken from
   the current production/server and firmware pipelines.
3. Build the Stylus contract for `wasm32-unknown-unknown`.
4. Run `cargo stylus check` to confirm the compiled WASM is valid for Stylus.
5. Export the Solidity ABI from the Stylus crate, commit or generate
   `IQualityScorer.sol`, and compile the Solidity reward contracts against that
   interface.
6. Run cross-language integration tests: Solidity calls the deployed/local
   Stylus scorer and must match the Rust golden vectors exactly.
7. Fuzz malformed or extreme sample payloads: empty samples, max-length samples,
   bad timestamps, duplicate points, overflow edges, and adversarial resampling
   boundaries.
8. Benchmark gas for realistic and worst-case hourly sample payloads. Set a hard
   maximum sample count/byte size in the contract so a claim cannot become
   uncallable.
9. Deploy the Stylus WASM contract, then activate/instrument it on Arbitrum.
   Stylus deployment is a WASM deploy plus activation step, not just `forge
   create`.
10. Deploy or upgrade the Solidity reward contract with the scorer address and
    expected scorer code/config version.
11. Publish the scorer address, ABI, code hash, config hash, and golden-vector
    test artifacts so operators can reproduce scores.

I would deploy this first to Arbitrum Sepolia with production-sized sample
payloads, then to Arbitrum One. If the current Solidity contracts are already on
another chain, either migrate the reward/staking surface to Arbitrum or keep the
old chain as a token/liquidity venue and make Arbitrum the canonical scoring and
reward-accrual chain. Splitting scoring on Arbitrum and rewards elsewhere would
reintroduce bridge/oracle complexity and dull the main benefit.

# Product Constraints To Lock Down

Before mainnet, make these product decisions explicit:

- Maximum samples per device-hour.
- Encoding format for samples, preferably compact binary with versioning.
- Whether raw samples are public. Onchain scoring means public inputs unless you
  add a privacy layer.
- Whether rewards finalize immediately or have a challenge window.
- Whether scorer upgrades are allowed, and if so under what timelock/governance.
- What happens when firmware and onchain scorer versions differ.

For upgrades, I would avoid silent scorer replacement. Use versioned scorer
contracts and make each reward epoch point at a specific scorer/config version.
That gives you clean reproducibility for old disputes.

# When This Would Be The Wrong Choice

Arbitrum Stylus stops being the right answer if the product changes in any of
these ways:

- **The raw hourly payloads are too large or too private to put onchain.** If the
  samples cannot be public calldata, use commitments plus zk proofs, TEEs, or an
  oracle/dispute game instead.
- **The scoring routine becomes too expensive even in WASM.** If worst-case
  scoring cannot fit comfortably inside transaction gas limits, move to batched
  claims, zk proofs of correct scoring, or an app-specific chain.
- **You need finality faster than an optimistic rollup's L1 withdrawal window.**
  For cross-chain withdrawals or settlement guarantees, a ZK rollup may matter
  more than Rust reuse.
- **The Rust implementation stops being the canonical source of truth.** If the
  algorithm becomes simple enough to express safely in Solidity, the main reason
  to choose Stylus disappears.
- **The reward system needs its own fee market, custom gas token, or much higher
  throughput.** Then an Arbitrum Orbit chain may be better than Arbitrum One.
- **The product requires private scoring.** Public verifiability and private raw
  measurements pull in opposite directions; Stylus gives you reusable Rust
  execution, not confidentiality.
- **You are willing to accept server attestations instead of onchain
  recomputation.** Then a signed oracle result feeding the existing Solidity
  contracts is simpler, but it will not solve the core dispute problem as cleanly.

Given the current facts, though, Arbitrum One plus a Stylus scorer is the clean
choice: one canonical Rust scoring implementation, normal Solidity reward
contracts, cheap enough hourly claims, and a dispute path that devices and
operators can independently replay.
