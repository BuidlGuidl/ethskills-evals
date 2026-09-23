# Recommendation

Deploy the rewards system on Arbitrum One and put the scoring routine in an Arbitrum Stylus contract.

This is the rare case where I would choose an L2 because of its execution environment, not just fees or liquidity. You already have Solidity contracts that you want to keep, and you already have a deterministic Rust scoring implementation that you do not want to port. Stylus lets Rust/WASM contracts live beside EVM contracts, and Solidity can call them through a normal ABI interface. That gives you one scoring implementation, onchain execution, and a clean path for the existing ERC-20, staking, slashing, and reward contracts to keep their Solidity shape.

I would start on Arbitrum One, not a custom chain. A few thousand devices posting once per hour is not, by itself, enough to justify operating your own chain. If calldata size, fee sponsorship, custom gas token needs, or throughput isolation later become the hard problem, then move to an Arbitrum Orbit chain using the same Stylus/EVM architecture.

# What runs onchain

Keep the existing reward system in Solidity:

- ERC-20 reward token.
- Staking contract.
- Slashing contract.
- Reward accounting and payout contract.

Add one new Stylus contract:

```solidity
interface IQualityScorer {
    function scoreHour(
        bytes32 deviceId,
        uint64 hour,
        bytes calldata packedSamples,
        bytes calldata deviceSignature
    ) external view returns (uint256 score);
}
```

The Stylus contract should be a thin Rust smart-contract wrapper around the same Rust crate used by firmware and the current server pipeline:

- `scoring-core`: the existing filter/resample/fixed-point scoring routine, kept deterministic and free of chain-specific code.
- `scoring-stylus`: ABI decoding, signature/domain checks if you want them in the scorer, input bounds, and calls into `scoring-core`.
- Firmware/server tooling imports `scoring-core` directly.

Do not store raw samples unless the product truly needs permanent onchain sample availability. The normal reward path should pass packed samples as calldata, compute the score, store the score plus `keccak256(packedSamples)`, and emit an event. The transaction input gives public replayability; the contract state stays small.

# How the reward contract calls scoring

The reward contract owns the policy; the scorer owns only the math.

Flow:

1. Device/operator submits `claim(deviceId, hour, packedSamples, signature)`.
2. Solidity verifies that the device is registered, the hour has not already been claimed, and the signature/domain are valid. If the signature verification is deeply tied to sample parsing, put that piece in Stylus too, but keep the final authorization check in Solidity.
3. Solidity calls `IQualityScorer(scorer).scoreHour(...)`.
4. Solidity computes the reward from the returned score, stake state, and emission schedule.
5. Solidity records `hourClaimed[deviceId][hour]`, stores the score and sample hash, emits the scored hour, and transfers or mints rewards.
6. Slashing uses the same recorded score, or calls the same scorer during a dispute path if it needs to recompute from submitted samples.

Make the scorer address versioned in the reward contract:

```solidity
IQualityScorer public scorer;
uint32 public scorerVersion;
```

Only governance can change it, with a timelock. That gives operators time to diff the Rust crate, test vectors, exported ABI, and expected gas before a scoring change goes live.

# What the deploy pipeline adds

A plain Solidity deploy becomes a mixed Solidity plus Rust/WASM deploy.

The extra pipeline pieces are:

- Pin the Rust toolchain, `Cargo.lock`, Stylus SDK version, and sample serialization format.
- Build and test `scoring-core` with the exact golden vectors used by firmware and the current server.
- Compile the Stylus wrapper to WASM using the Stylus toolchain.
- Run `cargo stylus check` in CI so invalid WASM, size issues, forbidden exports, and activation failures are caught before deploy.
- Benchmark worst-case sample payloads for gas/ink and calldata cost, not just happy-path scores.
- Deploy the Stylus scorer and activate it. Stylus deployment is not just a normal EVM bytecode deploy; the WASM must be posted and activated before it is callable.
- Export the Solidity ABI from the Stylus contract with `cargo stylus export-abi`, commit it, and have the Solidity contracts compile against that generated interface.
- Deploy or upgrade the Solidity reward contract with the activated scorer address.
- Verify both sides: Solidity source on Arbiscan and the Stylus deployment/artifacts where supported.
- Add monitoring for Stylus reactivation. Current Arbitrum docs say Stylus contracts must be reactivated once per year or after a Stylus upgrade, otherwise they become uncallable.

The most important CI gate is cross-environment equivalence: one corpus of real device hours, edge cases, and fuzz cases must produce the same score in firmware, native Rust tests, the Stylus test VM, and an Arbitrum devnet/testnet call.

# When this would be the wrong choice

This stops being the right architecture if the product changes in one of these ways:

- You become willing to maintain a second implementation. Then a normal Solidity implementation on Base, Optimism, Scroll, or even mainnet may be simpler operationally.
- The raw hourly samples are too large to put in calldata economically. Then you either need a commitment/challenge design, a zk proof of correct scoring, an oracle/attestation scheme, or a dedicated Orbit chain with cheaper/custom data availability.
- Scores do not need to be recomputed by the reward contract. If operators only need auditability, a signed score plus fraud window may be cheaper than executing the whole routine for every hour.
- The scoring routine becomes non-deterministic, floating-point-dependent, model-based, or reliant on large lookup tables/files that do not fit a bounded WASM contract well.
- You need fast L1 withdrawals or Ethereum L1 finality for reward settlement. Arbitrum One is an optimistic rollup, so parent-chain finality inherits the challenge window.
- The business needs custom sequencing, private ordering, gas sponsorship at protocol level, or a native network token more than it needs public L2 composability. That points to an Arbitrum Orbit chain rather than Arbitrum One.
- The device/operator ecosystem is already anchored somewhere else, for example Coinbase/Base wallets and onramps are the dominant requirement. In that case the Rust reuse benefit has to beat ecosystem distribution, and it may not.

Sources checked: Arbitrum's current Stylus docs describe Rust/WASM contracts, Solidity interoperability, deployment/activation, ABI export, current 96 KB Stylus contract size support, and yearly/reactivation requirements: https://docs.arbitrum.io/stylus/gentle-introduction and https://docs.arbitrum.io/stylus/quickstart.
