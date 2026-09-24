# Recommendation

Deploy the reward system on **Arbitrum One** and put the scoring routine in an **Arbitrum Stylus** contract written in Rust. Keep the ERC-20, staking, slashing, device registry, and reward accounting in Solidity.

The binding constraint is not "which L2 is cheapest in general"; it is that you already have a 2k-line deterministic Rust scoring routine and you are not willing to maintain a second implementation. Stylus is the L2 choice that lets that Rust become an onchain program while remaining callable from normal Solidity contracts. The fixed-point/no-float design is a good fit: the score should be deterministic across firmware, local simulation, and chain execution.

I would use Arbitrum One rather than Nova as the default because this is a rewards/slashing system where economic security and dispute credibility matter more than shaving every last cent off data availability. Nova or an Orbit chain could become attractive later if sample volume is the dominant cost and the product can accept weaker/custom DA assumptions, but I would not start there for a disputed reward ledger unless the business requirement explicitly says so.

# What Runs Onchain

Onchain Solidity remains the economic system:

- the ERC-20 reward token;
- staking and device/operator registration;
- slashing rules;
- reward epoch accounting;
- authorization checks for which device key may submit for which device/operator;
- replay protection for `deviceId + hour`;
- reward minting or distribution.

The Rust scoring code becomes a Stylus WASM contract:

- expose a small ABI such as `score(deviceId, hour, samples, configVersion) returns (uint32 qualityScore)`;
- keep it stateless if possible, with scoring constants/version stored immutably or behind a governed config hash;
- compile the same core Rust crate used by the server/device pipeline into the Stylus wrapper;
- avoid importing server-only dependencies into the scoring core;
- treat the onchain ABI encoding as an adapter around the existing routine, not as a rewrite of the scoring logic.

I would structure the Rust as:

- `scoring-core`: the shared deterministic algorithm, fixed-point types, filters, resampling, bounds checks, and test vectors;
- `scoring-stylus`: a thin Stylus contract that decodes calldata, calls `scoring-core`, and returns the score;
- firmware/server packages: continue importing `scoring-core` so the device-side estimate and the onchain result are produced by the same implementation.

Do not store raw samples in contract storage unless you truly need them there. Submit them as calldata to the reward transaction, emit the sample hash and resulting score, and store only compact state such as `claimed[deviceId][hour]`, `score`, `reward`, and the scoring version. The raw calldata is still publicly available, so if measurements are sensitive, this product needs a different design.

# How The Reward Contract Calls Scoring

The Solidity reward contract should call the Stylus scorer through a normal Solidity interface. From Solidity's point of view, the Stylus contract is just another contract address with an ABI.

Example shape:

```solidity
interface IQualityScorer {
    function score(
        bytes32 deviceId,
        uint64 hour,
        bytes calldata samples,
        uint32 configVersion
    ) external view returns (uint32 qualityScore);
}
```

The reward claim path should look like this:

```solidity
function claimHour(
    bytes32 deviceId,
    uint64 hour,
    bytes calldata samples,
    bytes calldata deviceSignature
) external {
    require(!claimed[deviceId][hour], "already claimed");
    require(isRegisteredAndStaked(deviceId, msg.sender), "not authorized");
    require(validDeviceSignature(deviceId, hour, samples, deviceSignature), "bad sig");

    uint32 quality = scorer.score(deviceId, hour, samples, activeConfigVersion);
    uint256 reward = rewardFor(deviceId, hour, quality);

    claimed[deviceId][hour] = true;
    recordedScore[deviceId][hour] = quality;

    rewardToken.mint(msg.sender, reward);
    emit HourScored(deviceId, hour, quality, reward, keccak256(samples), activeScorerVersion);
}
```

You can also add a batch entry point for operators or relayers submitting many devices per hour. The core invariant should stay the same: every paid score is computed by the onchain scorer from the submitted signed measurements, not accepted from an offchain server.

For gas UX, devices do not all need to hold ETH. A relayer/operator can submit claims, or you can add account-abstraction/paymaster support later. That is separate from the correctness story: the contract still recomputes the score before paying.

# What The Deploy Pipeline Adds

A plain Solidity deploy changes RPC URL and chain ID, then deploys bytecode. This build has extra steps because the scoring contract is Rust compiled to WASM and must be activated on Arbitrum.

The deploy pipeline should:

1. Build and test `scoring-core` as normal Rust, including golden vectors from production/device data.
2. Compile the Stylus wrapper to WASM with the Stylus toolchain.
3. Run the Stylus contract checks before deployment.
4. Export the ABI for the Rust scorer and generate the Solidity interface/types used by the reward contracts.
5. Deploy the Stylus scoring program to Arbitrum Sepolia, then mainnet.
6. **Activate** the deployed Stylus program onchain via Arbitrum's WASM activation flow before the Solidity reward contract is pointed at it.
7. Deploy or upgrade the Solidity reward contracts with the activated scorer address and expected scorer/version hash.
8. Run cross-VM integration tests where Solidity calls the Stylus scorer and the result is compared against the native Rust test vectors.
9. Verify/publish both sides: Solidity source as usual, plus the Stylus WASM/source metadata and the scoring version hash.
10. Gate production upgrades so a new scorer cannot silently change rewards: deploy new scorer, activate it, run vector tests, publish the version, then switch `activeScorerVersion` through governance/timelock.

Operationally, the CI artifact that matters is no longer just Solidity bytecode. It is the tuple:

```text
scoring-core git commit
Stylus WASM artifact hash
Stylus scorer address
activation transaction
Solidity reward contract address
active scorer/config version
golden-vector test report
```

# When This Would Be The Wrong Choice

This stops being the right choice if the product changes so that Rust reuse is no longer the binding constraint. For example, if the scoring routine is simplified enough to fit cleanly in Solidity, or the team becomes willing to maintain and audit a Solidity implementation, then deploying to a more standard EVM L2 may be simpler.

It is also wrong if the raw hourly sample data is the expensive part rather than the computation. Stylus helps with compute-heavy logic, but the samples still have to be supplied to the chain for the contract to score them. If each device-hour contains large payloads, data availability costs will dominate and you should consider an offchain scoring plus fraud-proof window, a zk proof of correct scoring, or a dedicated/custom DA design instead.

It is wrong if the measurements must remain private. The claim transaction reveals the samples unless you replace the design with commitments and proofs.

It is wrong if rewards must compose synchronously with mainnet liquidity or mainnet contracts. Arbitrum withdrawals to L1 are optimistic-rollup withdrawals with a challenge window, so mainnet-native settlement or instant L1 composability would point somewhere else.

And it is wrong if the scoring code stops being deterministic and bounded. Anything that needs floating point, wall-clock reads, network access, nondeterministic ordering, or unbounded memory over arbitrary sample payloads should not be dropped into an onchain scorer as-is.
