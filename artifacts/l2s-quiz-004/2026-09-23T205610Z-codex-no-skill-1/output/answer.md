# Deployment choice

Deploy the rewards system on an Arbitrum Stylus chain, either Arbitrum One if the public L2 is acceptable or an Arbitrum Orbit chain if the DePIN network wants its own fee token, throughput envelope, or governance. Keep the existing ERC-20, staking, slashing, and reward accounting as Solidity contracts. Deploy the scoring routine as a Stylus Rust contract compiled to WASM.

That is the right fit because the hard requirement is not just "run scoring onchain"; it is "do not maintain a second implementation." Stylus lets the same Rust fixed-point scoring code be compiled into an onchain contract while remaining callable from ordinary Solidity through an ABI. The Solidity contracts stay where they are strongest: token balances, stake state, slashing, payout authorization, and upgrade/admin policy. The Rust contract owns only deterministic scoring.

# What runs onchain

The Stylus contract should expose a narrow ABI around the existing Rust scorer, for example:

```solidity
interface IQualityScorer {
    function scoreHour(
        bytes32 deviceId,
        uint64 hour,
        bytes calldata signedSamples
    ) external view returns (uint32 score, bytes32 traceHash);
}
```

The Rust/WASM contract performs signature/domain checks if those are part of scoring validity, parses the hour of samples, runs the existing filtering/resampling/fixed-point math, and returns the quality score. If the raw hour is large, the ABI can instead take a compressed sample payload or a commitment plus required revealed data, but the important point is that the computation used for payment is the Rust scorer running onchain.

The Solidity reward contract calls the scorer before minting or releasing rewards:

```solidity
function claimHour(bytes32 deviceId, uint64 hour, bytes calldata samples) external {
    require(!claimed[deviceId][hour], "already claimed");
    require(isDeviceOperator(deviceId, msg.sender), "not operator");

    (uint32 score, bytes32 traceHash) = scorer.scoreHour(deviceId, hour, samples);
    uint256 reward = rewardFor(score, stakeOf[deviceId]);

    claimed[deviceId][hour] = true;
    lastScore[deviceId][hour] = score;
    _pay(msg.sender, reward);
    emit HourScored(deviceId, hour, score, traceHash, reward);
}
```

This makes the score reproducible by the device/operator: they can run the same Rust library locally, submit the same hour, and compare the returned score and reward against the contract result. The reward contract should treat the scorer address as a versioned dependency. When the scoring algorithm changes, deploy a new scorer and activate it from a specific hour onward so old claims remain auditable.

# Build and deploy pipeline

The repository should split the scorer into a pure Rust crate and a thin Stylus wrapper crate:

- `scoring-core`: the existing no-std-friendly deterministic Rust library, shared with firmware and tests.
- `scoring-stylus`: ABI wrapper that decodes calldata, calls `scoring-core`, maps errors to reverts, and exposes Solidity-compatible entrypoints.
- `contracts`: the existing Solidity ERC-20, staking, slashing, and rewards contracts plus the `IQualityScorer` interface.

The deploy pipeline has extra steps compared with a plain Solidity deployment:

1. Build and test the Rust scorer as a normal Rust crate using golden vectors from firmware/server history.
2. Compile the Stylus wrapper to WASM with the Stylus toolchain.
3. Run Stylus-specific checks: WASM size, forbidden imports, determinism, ABI export validation, and gas/cost profiling for realistic hourly payloads.
4. Generate or commit the Solidity ABI/interface for the Rust scorer.
5. Deploy the WASM scorer contract to the Stylus chain and activate/register its code according to the Stylus deployment flow.
6. Deploy or upgrade the Solidity reward contract with the scorer address.
7. Run integration tests where Solidity calls the deployed Stylus scorer and compares results to the same Rust golden vectors.
8. Publish the scorer version, code hash, ABI, and activation hour so operators can reproduce the exact payment path.

The important pipeline difference is that one artifact is not EVM bytecode from `solc`; it is Rust compiled to WASM and deployed as a Stylus contract, with ABI glue so Solidity can call it. CI should fail if firmware/server scoring vectors, native Rust scoring, and onchain Stylus scoring diverge.

# When this would be the wrong choice

Stylus would stop being the best answer if the product changed so that reusing Rust was no longer central. If the scoring routine became small enough to write and audit directly in Solidity, plain Solidity on an EVM L2 would be simpler.

It would also be wrong if the hourly raw data were too large or too private to put through calldata, even on an L2. In that version of the product, an offchain scorer with fraud proofs, a commit/reveal challenge game, or a ZK proof of correct scoring may fit better than executing the whole routine onchain.

Finally, this choice would be wrong if scoring started depending on nondeterministic or external resources: floating point behavior, wall-clock time, network calls, large model inference, database lookups, or hardware-specific sensor calibration that cannot be represented as deterministic inputs. Onchain execution needs a closed, deterministic function of submitted data. The current product has exactly that: Rust, fixed-point integer math, shared with firmware, and a strong need for Solidity contracts to call it directly.
