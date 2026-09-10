# Interest-accrual review

## Conclusion

Arbitrum did not overcharge because, on Arbitrum One, Solidity's `block.number` does **not** return the rapidly increasing Arbitrum L2 block number. Arbitrum gives the `NUMBER` opcode the parent Ethereum block number. The contract therefore counted approximately the same Ethereum blocks on mainnet and Arbitrum and, with `SECONDS_PER_BLOCK = 12`, produced approximately the same result. Arbitrum's own L2 block number is available separately through `ArbSys.arbBlockNumber()`.

Base is different. It is an OP Stack chain and `block.number` is the L2 block number. Base produces a sealed L2 block every 2 seconds, so this code will treat each 2 seconds as 12 seconds and accrue at approximately **six times the intended rate**. The contract should not be deployed to Base unchanged.

## 1. July reconciliation

The contractual simple-interest benchmark is:

```
1,000,000 * 0.04 * 31 / 365 = 3,397.260274 USDC
```

At exactly one block per 12 seconds, 31 days would contain:

```
31 * 86,400 / 12 = 223,200 blocks
```

Each counted block contributes, before compounding and integer truncation:

```
1,000,000 * 0.04 * 12 / 31,536,000
= 0.015220700152 USDC
```

A charge of about 3,391 USDC corresponds to about:

```
3,391 / 0.015220700152 = 222,789 counted blocks
```

That is about 411 fewer than the idealized 223,200, equivalent to 4,936 seconds (1.37 hours) under this contract's twelve-seconds-per-block fiction.

That shortfall is not surprising. Ethereum has 12-second **slots**, not a guarantee of one executed block every 12 wall-clock seconds. Missed slots do not increment `block.number`. Measurement endpoints need not coincide exactly with midnight either. Thus `blocksElapsed * 12` can be a little less than the actual 31-day interval. Integer division also rounds each accrual increment down, although its monetary effect depends on the scale used for `index` and the number of calls. The supplied aggregate figures are enough to explain the approximate $6 difference, but not to allocate it exactly among missed slots, boundary timing, rounding, and call cadence; that would require the two endpoint blocks and the accrual transactions.

Arbitrum agrees because it exposes the parent-chain number through Solidity `block.number`, rather than incrementing that value every roughly 250 ms. This is documented behavior, not a consequence of the identical bytecode or deployment dates. See the [Arbitrum documentation-hosted security review describing `block.number` as the first non-Arbitrum parent-chain number](https://docs.arbitrum.io/assets/files/2025-12-offchain-arbitrum-chains-genesis-generator-securityreview-ecc17bd8f262c11ea3c8fd6458ff271e.pdf).

There is one further accounting qualification: the function is not strictly simple interest when called more than once. Because every increment is calculated from the already increased `index`, calls compound the rate. Therefore a result cannot in general be predicted exactly from only the start date and end date; the call schedule is also an input. Frequent calls increase interest, while integer truncation at every call can decrease it slightly.

## 2. Result on Base

Base's protocol specifies 2-second L2 blocks. The derivation documentation describes a 12-second Ethereum epoch as normally containing six 2-second L2 blocks: [Base derivation specification](https://docs.base.org/base-chain/specs/protocol/consensus/derivation). Flashblocks/preconfirmations may update more frequently, but they are not additional sealed block numbers for this calculation.

Over 31 uninterrupted days Base therefore produces approximately:

```
31 * 86,400 / 2 = 1,339,200 L2 blocks
```

The contract converts those blocks to fictional elapsed time as follows:

```
1,339,200 * 12 = 16,070,400 seconds
                      = 186 days
```

If `accrueInterest()` is called once at the end of the period, the calculation is:

```
1,000,000 * 0.04 * 16,070,400 / 31,536,000
= 20,383.561644 USDC
```

So the one-call result is about **20,384 USDC**, exactly six times the intended simple-interest amount of 3,397.26 USDC (subject to integer rounding and the actual endpoint blocks).

If the function is called during the month, compounding makes it higher. Illustratively:

- one call at month-end: about **20,383.56 USDC**;
- one call per day: about **20,585.89 USDC**;
- one call in every Base block: about **20,592.73 USDC**.

Those examples assume a constant debt, exact 2-second blocks, and sufficient fixed-point precision. The precise on-chain number depends on actual block count, call placement, and integer truncation. The economically relevant headline is an effective nominal rate near 24% per year rather than 4%, plus the contract's call-dependent compounding.

## Recommendation

Replace block-count timekeeping with elapsed timestamp timekeeping:

```solidity
uint256 elapsed = block.timestamp - lastAccrualTimestamp;
if (elapsed == 0) return;

index += index * rateBps * elapsed / (10_000 * 365 days);
lastAccrualTimestamp = block.timestamp;
```

Store `lastAccrualTimestamp` at deployment and apply normal checks-effects-interactions discipline around any surrounding logic. `block.timestamp` is the appropriate EVM clock for elapsed-time interest; small permitted timestamp variation is immaterial for month-long fixed-rate accrual and vastly safer than assuming a chain-specific block interval.

Also make an explicit product decision about simple versus compounded interest. The replacement above preserves the current call-dependent compounding. If the advertised 4.00% is meant to be simple interest, calculate debt from a fixed principal and cumulative elapsed time (or use an index formula whose compounding convention and period are specified), rather than repeatedly adding a percentage of the current index. Add cross-chain tests that advance timestamp and block number independently, test arbitrary accrual-call schedules, and verify rounding at USDC's six-decimal precision.

Do not solve this by changing `SECONDS_PER_BLOCK` to 2 for Base. Block schedules can change, sequencers can pause, and chain-specific `block.number` semantics differ—as the Arbitrum result already demonstrates.
