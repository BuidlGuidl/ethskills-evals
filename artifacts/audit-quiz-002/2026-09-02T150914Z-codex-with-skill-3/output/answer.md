# Reconciliation and Base deployment assessment

## Executive conclusion

The Arbitrum result is not anomalous. Inside an Arbitrum One contract, Solidity's `block.number` is an approximate Ethereum L1 block number, not the fast Arbitrum L2/RPC block height. The two deployments are therefore using substantially the same clock: Ethereum blocks multiplied by 12 seconds.

Base is different. On current Base mainnet, `block.number` advances with Base's approximately two-second canonical L2 blocks. Deployed unchanged, the contract will therefore accrue at roughly six times the intended rate. It should not be deployed to Base unchanged.

## 1. July

The intended simple pro-rata interest is:

```text
1,000,000 * 0.04 * 31 / 365 = 3,397.260274 USDC
```

The premise that Arbitrum's roughly 250 ms transaction cadence drives this calculation is the mistaken part. Arbitrum distinguishes its child-chain/RPC block height from the value returned by the EVM `NUMBER` opcode. Its documentation says that Solidity `block.number` returns a value close to the block number of the first non-Arbitrum ancestor—Ethereum for Arbitrum One—and is synchronized with Ethereum periodically. The separate Arbitrum height can be obtained through `ArbSys.arbBlockNumber()`, but this code does not call it. See [Arbitrum: block numbers and time](https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time).

Consequently, on both Ethereum and Arbitrum One the contract approximately computes:

```text
Ethereum blocks elapsed * 12 seconds/block
```

That explains why the deployments agree despite being deployed on different days. Their deployment dates merely select slightly different Ethereum block intervals; they do not cause the Arbitrum contract to count all Arbitrum L2 blocks.

The small shortfall is also consistent with using block height as a clock. Ethereum schedules slots 12 seconds apart, but a slot can be empty; `block.number` advances for produced blocks, not for an empty slot. Accrual boundary times can add another small discrepancy. Ethereum documents both the 12-second slot and the possibility of an empty slot in [Ethereum blocks](https://ethereum.org/developers/docs/blocks/).

Working backward from 3,391 USDC under a one-period/simple calculation:

```text
accounted seconds = 3,391 / (1,000,000 * 0.04) * 365 days
                  = 2,673,464.4 seconds

accounted blocks  = 2,673,464.4 / 12
                  = 222,788.7 blocks

ideal 31-day slots = 31 * 86,400 / 12
                   = 223,200 slots

difference         = about 411 blocks
                   = about 4,936 synthetic seconds
                   = about 82.3 minutes, or 0.184% of the month
```

The fractional inferred block is just a consequence of starting from a rounded USDC result. Missed L1 slots and the precise reconciliation cutoffs readily explain a gap of that order. The actual first and last accrual blocks and the complete `accrueInterest()` call history are needed to tie the result exactly to 3,391.

There is a second issue hidden in the function: call cadence changes the charge. Each call increases `index`, and a later call earns interest on that increase. One call for a perfect 31-day interval produces 3,397.26 USDC, but daily calls produce about 3,402.85 and near-every-block calls approach 3,403.04. Integer division rounds each update down, but with a conventional high-precision index that effect should be tiny; without the index scale it should not be credited with explaining a six-dollar difference. Compounding pushes upward, so it cannot itself explain why 3,391 is below the simple-interest benchmark.

## 2. Base

Base currently builds a canonical L2 block about every two seconds. Its roughly 200 ms Flashblocks are preconfirmations, not additional canonical `block.number` increments. See [Base transaction finality](https://docs.base.org/base-chain/network-information/transaction-finality).

For 31 days, assuming the same one-period/simple comparison used for the 3,397 benchmark:

```text
Base blocks       = 31 * 86,400 / 2
                  = 1,339,200

time invented by the contract
                  = 1,339,200 * 12 seconds
                  = 16,070,400 seconds
                  = 186 days

interest          = 1,000,000 * 0.04 * 186 / 365
                  = 20,383.561644 USDC
```

That is exactly six times the intended simple charge of 3,397.260274 USDC. The actual charge is cadence-dependent: daily accrual is about 20,585.89 USDC, while near-every-block accrual approaches 20,592.73 USDC. Production gaps, boundary blocks, and integer rounding will move the exact result slightly.

There is also a roadmap risk worth checking immediately before deployment. Base documents a proposed Denim upgrade from two-second canonical blocks to 200 ms canonical blocks. As of this assessment, it is experimental on Vibenet, is not active on Base mainnet, and has no scheduled mainnet activation. If it were activated, this unchanged code would run at roughly 60 times wall-clock time: one-period 31-day interest would be about 203,835.62 USDC. See [Base: 200 ms native blocks](https://docs.base.org/upgrades/denim/200ms-blocks).

## Recommended change

Do not deploy this implementation unchanged. Store `lastAccrualTimestamp` and calculate elapsed time from `block.timestamp - lastAccrualTimestamp`. That removes the chain-specific block-time assumption and the systematic undercount from missed Ethereum slots.

Also decide and encode the product's intended rate semantics:

- If 4.00% means simple fixed APR, do not repeatedly multiply an already-grown index by a linear period rate in a caller-controlled function. Anchor accrued interest to principal and elapsed time, or maintain a linear accumulator whose result is invariant to how callers partition an interval.
- If compounding is intended, document whether 4.00% is APR or APY and use a vetted timestamp-based cumulative factor whose result depends only on total elapsed time, not on how often an arbitrary caller invokes the function.

Use sufficient fixed-point precision/full-precision `mulDiv`, specify the rounding direction, accrue before every borrow, repay, liquidation, and other index-sensitive transition, and initialize/migrate the timestamp and old index atomically. Tests should compare the same wall-clock trace on Ethereum, Arbitrum, and Base and should explicitly split an identical interval into one, daily, and very frequent calls; all three partitions should yield the product's specified result.
