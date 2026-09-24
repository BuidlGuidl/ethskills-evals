# Recommendation

Deploy the rewards system on an Arbitrum chain with Stylus enabled, starting with
Arbitrum One unless hourly calldata cost dominates the reward economics. Keep the
ERC-20, staking, and slashing contracts in Solidity, and deploy the scoring
routine as a Rust Stylus contract compiled to WASM.

This is the right fit because the hard requirement is not "run Rust somewhere
near the chain"; it is "do not maintain a second implementation of the scoring
algorithm." Stylus lets the Rust scoring code live onchain while still exposing
an Ethereum ABI, so your existing Solidity contracts can call it like any other
contract. Your fixed-point, no-float routine is also a good match for deterministic
contract execution.

# What Runs Onchain

Split the Rust code into a reusable scoring crate and a thin Stylus adapter:

- `scoring-core`: the existing filter/resample/score logic, kept as ordinary
  Rust, deterministic, fixed-point, and shared by firmware, offchain tests, and
  the onchain contract.
- `scoring-stylus`: a small `stylus-sdk` wrapper that decodes ABI inputs,
  calls `scoring-core`, and returns a bounded integer score plus any reason/error
  code needed for disputes.
- Solidity reward contracts: your current ERC-20, staking, slashing, epoch
  accounting, and payout logic.

The scoring contract should be mostly stateless. Put product parameters that
change by governance or epoch in Solidity or in a small config contract, then
pass the relevant config/version into the scorer. That keeps the expensive Rust
contract focused on pure computation and makes scoring versions auditable.

For each device-hour, the submitted data path should look like this:

1. The device signs its hour identifier and raw sample payload, or signs a
   commitment to the payload if the payload is submitted later.
2. The reward claim submits the device id, hour, raw samples or committed sample
   bundle, signature/proof metadata, and expected config version.
3. The Solidity reward contract checks eligibility, stake status, replay
   protection, epoch windows, signature authority, and whether the hour has
   already been paid.
4. The Solidity contract calls the Stylus scorer through a normal Solidity
   interface:

   ```solidity
   interface IQualityScorer {
       function scoreHour(
           bytes32 deviceId,
           uint64 hour,
           bytes calldata samples,
           uint32 configVersion
       ) external view returns (uint32 score);
   }
   ```

5. The Solidity reward contract converts `score` into token rewards or slashing
   consequences and stores only the compact result: paid/not paid, score, epoch,
   and perhaps a hash of the raw submitted samples.

Use `staticcall` semantics for scoring from the reward path if the scorer is
pure/view. Do not let the Rust scorer transfer tokens, mutate staking state, or
decide slashing policy. It should answer one question: "given this hour of
samples and this scoring version, what is the quality score?"

# How Solidity Calls The Scorer

From Solidity, the Stylus contract is just another ABI-compatible contract. The
reward contract stores `IQualityScorer public scorer`, calls `scorer.scoreHour(...)`,
and uses the returned integer in the existing reward formula.

That means upgrades are also straightforward:

- Put the scorer address behind governance-controlled configuration in the
  reward contract.
- Version every scoring release.
- Emit events when a scorer version becomes active.
- Freeze old scorer addresses for old epochs so historical disputes evaluate
  against the exact code that was live then.

If you already use proxies for the Solidity contracts, avoid proxying the scoring
algorithm itself unless you have a strong reason. Immutable scorer deployments
with explicit version selection are easier for operators to reproduce and trust.

# Deploy Pipeline Differences

A plain Solidity deployment compiles EVM bytecode, deploys it, verifies it, and
wires addresses. This build has an extra Rust/WASM lane.

The pipeline should do the following:

1. Run the normal Rust test suite for `scoring-core`, including firmware
   compatibility vectors.
2. Run property and golden-vector tests that compare:
   - firmware scoring,
   - native Rust scoring,
   - Stylus contract scoring on a local/dev/test chain.
3. Build the Stylus contract for `wasm32-unknown-unknown`.
4. Run `cargo stylus check` against the target Arbitrum RPC so the WASM passes
   Stylus activation checks before deployment.
5. Export the ABI with `cargo stylus export-abi` and commit/publish it for the
   Solidity package to consume.
6. Deploy and activate the Stylus contract. This is not a single normal EVM
   deploy; Stylus deployment includes WASM deployment and onchain activation.
7. Verify the Stylus contract with reproducible build metadata.
8. Deploy or upgrade the Solidity reward contracts with the scorer address and
   active scoring version.
9. Run an integration script on Arbitrum Sepolia and then mainnet that submits
   real sample fixtures and proves the reward amount matches the expected Rust
   output.

The release artifact should include the scorer contract address, git commit,
Rust compiler/toolchain versions, `Cargo.lock`, scoring config hash, exported
ABI, and golden test vectors. This matters because the product promise is
operator-verifiable scoring, not just "the server says so."

# When This Would Be The Wrong Choice

Stylus on Arbitrum stops being the right answer if any of these product facts
change:

- You no longer need exact Rust reuse. If the scoring algorithm becomes small
  and stable enough to rewrite safely, ordinary Solidity on the chain where your
  rewards already live may be simpler.
- The raw hourly payloads become too large or too numerous for per-claim
  execution and calldata, even on an L2. Then use offchain computation plus a
  fraud-proof/challenge game, zk proof, or a dedicated data availability design
  instead of recomputing every score onchain.
- Scores require private data. Public onchain scoring exposes submitted samples
  to validators, RPCs, indexers, and competitors. If the samples are sensitive,
  use commitments plus proofs, TEEs, or a privacy-preserving proving system.
- The algorithm starts depending on floats, nondeterministic libraries, wall
  clock behavior, external web data, large heap allocation, or OS services. That
  breaks the "same deterministic Rust core onchain and in firmware" model.
- Rewards must remain on an L1 or a non-Arbitrum ecosystem for liquidity,
  governance, or integration reasons. Cross-chain calls to a Stylus scorer would
  add latency and trust assumptions; at that point a proof-based design may be
  cleaner.
- The network grows into a high-throughput protocol where you need custom gas
  policy, custom fee token, or controlled data availability. Then the same
  architecture may still be right, but the deployment target should move from
  shared Arbitrum One to a Stylus-enabled Arbitrum Orbit chain.

Sources checked: Arbitrum's current docs describe Stylus as Rust/C/C++ contracts
compiled to WASM and deployed on Arbitrum chains, the Stylus SDK documents
Solidity ABI interoperability, and `cargo-stylus` documents the `check`,
`deploy`, activation, and `export-abi` steps.
