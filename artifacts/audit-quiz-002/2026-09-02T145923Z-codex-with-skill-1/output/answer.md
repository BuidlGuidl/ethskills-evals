# Fixed-rate accrual across Ethereum, Arbitrum, and Base

## Conclusion

Do **not** deploy this code unchanged to Base. On Arbitrum One, Solidity's `block.number` is approximately the Ethereum L1 block number, so the code accidentally behaves much like it does on mainnet. On Base, `block.number` is the Base L2 block number, which normally advances every two seconds. The hard-coded 12 seconds therefore makes time—and interest—run approximately six times too fast on Base.

There is a second issue: the result depends on how often anyone calls `accrueInterest()`. Each update is linear for that interval, but it applies to an already-increased `index`, so splitting a period into more calls compounds the debt more frequently. Consequently, the snippet alone cannot determine an exact monthly charge without the call history and the index's fixed-point precision.

## 1. July reconciliation

The finance benchmark is simple 4.00% APR over 31 days:

```text
1,000,000 * 0.04 * 31 / 365
= 3,397.260274 USDC
```

### Why Arbitrum did not charge roughly 48 times too much

Arbitrum's roughly 250 ms L2 production cadence is not what the EVM `NUMBER` opcode exposes to this contract. On Arbitrum One, Solidity's `block.number` returns an approximation of the first non-Arbitrum ancestor's block number—Ethereum L1—not the Arbitrum child-chain height. The native Arbitrum height is available separately from `ArbSys(100).arbBlockNumber()`. The [Arbitrum documentation explains this distinction](https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time).

Thus both deployments are effectively doing this over a long interval:

```text
change in Ethereum block height * 12 seconds
```

That is why they agree. Arbitrum may observe the approximate L1 number in delayed jumps, and many Arbitrum transactions can see the same `block.number`, but those effects are small at month scale.

### Why both were slightly below 3,397 USDC

Ethereum has 12-second **slots**, but not necessarily one block in every slot. Empty/missed slots consume wall-clock time without incrementing execution-layer block height. Ethereum's own [block documentation](https://ethereum.org/developers/docs/blocks/) explicitly notes that slots are 12 seconds and can be empty. Therefore `blocksElapsed * 12` normally understates elapsed wall time whenever slots are missed.

For scale, treating the reported 3,391 USDC as an unrounded, single-period result implies:

```text
modeled seconds = 3,391 * 365 days / (1,000,000 * 0.04)
                = 2,673,464.4 seconds

modeled blocks  = 2,673,464.4 / 12
                = 222,788.7 blocks

ideal 31-day slots = 31 days / 12 seconds
                   = 223,200 slots

difference ≈ 411 blocks ≈ 4,936 seconds ≈ 82 minutes ≈ 0.184%
```

That magnitude is consistent with missed slots plus reconciliation endpoint placement and integer truncation. It is not possible to prove that missed slots alone account for the exact six-dollar difference from the information given. To reproduce the exact number, finance should retain the start/end timestamps and block numbers, every `accrueInterest()` call, the starting index, its scale, and the final rounding rule.

Call cadence cannot by itself explain an undercharge: absent integer truncation, more calls increase the result. At perfect 31-day timing, one update gives 3,397.26 USDC, daily updates give about 3,402.85 USDC, and extremely frequent updates approach about 3,403.04 USDC. Integer division rounds each index increment down, but its dollar effect depends on the undisclosed index scale and number of calls.

## 2. What happens on Base

Base is an OP Stack chain. Its canonical L2 blocks are produced approximately every two seconds; the [Base documentation distinguishes two-second L2 blocks from 200 ms Flashblock preconfirmations](https://docs.base.org/base-chain/network-information/transaction-finality). Flashblocks do not make the contract's canonical block number advance every 200 ms. The OP Stack derivation rules also describe a [two-second L2 block interval](https://docs.base.org/base-chain/specs/protocol/consensus/derivation).

For 31 days at two seconds per Base block:

```text
actual elapsed seconds = 31 * 86,400
                       = 2,678,400

Base blocks            = 2,678,400 / 2
                       = 1,339,200

seconds used by code   = 1,339,200 * 12
                       = 16,070,400 seconds
                       = 186 days
```

With one accrual covering the whole month, the charge is therefore:

```text
1,000,000 * 0.04 * 186 / 365
= 20,383.561644 USDC
```

That is exactly six times the simple 31-day benchmark, or about **20,384 USDC** rather than 3,397 USDC.

It is not an unconditional exact figure because the public function compounds on every call. Ignoring fixed-point truncation:

- one call spanning the month: **20,383.56 USDC**;
- one call per wall-clock day: about **20,585.89 USDC**;
- calls every Base block: about **20,592.73 USDC**.

An arbitrary real call schedule will produce a value between the single-period and frequent-call results, subject to downward integer rounding. Because anyone can call, an external party can influence the amount within that range.

## Recommended change

Replace the block-height clock with elapsed timestamps:

```solidity
uint256 elapsed = block.timestamp - lastAccrualTimestamp;
lastAccrualTimestamp = block.timestamp;
```

For month-scale interest, `block.timestamp` is the portable EVM clock. It still has chain-specific sequencer/validator constraints, but it measures seconds directly and does not embed a false block-time assumption.

Also specify whether “4.00% per year” means simple APR or a compounded rate, then make the result independent of public call partitioning:

- If it is simple APR, accrue from principal and elapsed time without repeatedly applying the rate to previously accrued interest merely because someone called the function.
- If compounding is intended, use a documented fixed-period/per-second growth factor with full-precision fixed-point exponentiation so `growth(a + b) = growth(a) * growth(b)` apart from controlled rounding.

Use full-precision `mulDiv`-style arithmetic with an explicit rounding policy, initialize the timestamp atomically at deployment, and test identical wall-clock intervals on every target chain. This removes both the Base six-times error and the caller-controlled compounding ambiguity.
