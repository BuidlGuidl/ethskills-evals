# Reconciliation and Base deployment assessment

## Conclusion

Arbitrum did not overcharge because `block.number` on Arbitrum One is not the Arbitrum L2 block height. It reports the most recently observed Ethereum (parent-chain) block number. Thus both deployments are effectively using Ethereum blocks as a rough clock and multiplying them by 12 seconds. Arbitrum's ~250 ms L2 block production is irrelevant to this code.

Base is different. Its `block.number` is the Base L2 block number, and Base produces a canonical L2 block every 2 seconds. The contract will therefore treat each 2 seconds of real time as 12 seconds: its clock will run approximately 6 times too fast. It should not be deployed to Base unchanged.

## 1. July

The quoted rate-only result is correct for simple interest using exact elapsed wall-clock time:

```
1,000,000 * 0.04 * 31 / 365 = 3,397.260274 USDC
```

The contract does not measure that time. It measures the number of produced Ethereum blocks and assumes exactly 12 seconds for each. On Ethereum, slots occur every 12 seconds, but a missed slot produces no execution block and therefore no increment of `block.number`. Consequently `blocksElapsed * 12` is normally a little less than wall-clock elapsed time.

Ignoring call-by-call compounding and integer truncation for the moment, a charge of 3,391 corresponds to:

```
imputed time = 3,391 / (1,000,000 * 0.04) * 365 days
             = 2,673,464.4 seconds

31 days      = 2,678,400.0 seconds
difference   =     4,935.6 seconds = 82.26 minutes

imputed blocks = 2,673,464.4 / 12 = 222,788.7
ideal blocks   = 2,678,400.0 / 12 = 223,200.0
```

The fractional block merely reflects that 3,391 is a rounded accounting result. The size and direction of the discrepancy are consistent with using produced Ethereum blocks as a clock: approximately 411 twelve-second slots' worth of July is absent from the time estimate.

Arbitrum lands in the same place because its `NUMBER` opcode has special semantics: `block.number` returns the block number of the first non-Arbitrum parent chain—Ethereum for Arbitrum One—while the native Arbitrum L2 height is separately available as `arbBlockNumber`. This behavior is described in an [Offchain Labs-hosted security review](https://docs.arbitrum.io/assets/files/2025-12-offchain-arbitrum-chains-genesis-generator-securityreview-ecc17bd8f262c11ea3c8fd6458ff271e.pdf). Arbitrum may observe an Ethereum block with some lag and in steps, so the two results need not be exactly identical over arbitrary endpoints, but over a month they count essentially the same parent-chain interval.

There are two smaller qualifications to the exact reconciliation:

- Every integer division rounds down.
- The update is applied to the current `index`, so separate calls compound. More calls produce slightly more interest than one call covering the same total block interval. At 4% APR the theoretical difference between one July update and near-continuous updates is about 5.78 USDC on 1,000,000 USDC, before missed slots and integer rounding.

Therefore the reported rounded value is readily explained, but it is not possible to reproduce **exactly** 3,391 from the information given. Exact reproduction requires each deployment's starting and ending `block.number`, the sequence of blocks in which `accrueInterest()` ran, the starting index/debt representation, and its token-unit rounding. The important conclusion is unaffected: both contracts used the Ethereum block counter, and both slightly under-measured wall time because missed Ethereum slots are not blocks.

## 2. What the unchanged code does on Base

Base's OP Stack derivation rules advance the L2 timestamp by `l2_block_time` for each L2 block, and Base documents its L2 block interval as 2 seconds. See the [Base derivation specification](https://docs.base.org/base-chain/specs/protocol/consensus/derivation) and [Base configuration reference](https://docs.base.org/base-chain/specs/reference/configurability). The newer 200 ms Flashblocks are partial preconfirmations within the same canonical 2-second block; they do not make the multiplier 60×. Base documents that distinction in its [Flashblocks FAQ](https://docs.base.org/base-chain/flashblocks/faq).

For 31 days, assuming normal continuous 2-second block production:

```
Base blocks       = 31 * 86,400 / 2 = 1,339,200
contract seconds  = 1,339,200 * 12 = 16,070,400
                  = 186 days
```

If `accrueInterest()` is called once at the end, the charge is:

```
1,000,000 * 0.04 * 186 / 365 = 20,383.561644 USDC
```

That is exactly 6 times the intended simple-interest result, subject to integer rounding.

Because the function compounds at every call, there is no single exact charge without a call schedule. Representative results, ignoring token-level integer dust, are:

| Call schedule | Interest on 1,000,000 USDC over 31 days |
|---|---:|
| One call at the end | 20,383.56 USDC |
| Once per real day | 20,585.89 USDC |
| Every Base block (maximum frequency) | 20,592.73 USDC |

The every-block figure is computed as:

```
1,000,000 * ((1 + 0.04 * 12 / 31,536,000)^1,339,200 - 1)
  = 20,592.73 USDC
```

So the practical answer is approximately **20.4k–20.6k USDC**, depending on when callers invoke accrual, rather than the intended 3,397.26 USDC.

## Recommendation

Do not deploy this bytecode unchanged to Base. Replace the block-count clock with elapsed timestamp time:

```solidity
uint256 elapsed = block.timestamp - lastAccrualTimestamp;
```

Then update `lastAccrualTimestamp` together with the index. This removes chain-specific block-time assumptions and naturally handles missed blocks. Timestamps are not suitable as a source of randomness, but they are the appropriate clock for month-scale interest accounting.

Also specify the intended financial convention:

- If the product promises simple interest, make the index a deterministic function of elapsed time from a stored rate-period anchor. Do not repeatedly add interest to the already increased index, because that makes the result depend on how often a public function is called.
- If the product promises compounded interest, use a documented fixed compounding convention or a deterministic time-based exponentiation method, so arbitrary callers cannot choose the effective compounding frequency.

Finally, test the replacement against timestamp jumps, multiple calls at the same timestamp, long inactivity, rate changes, overflow bounds, and USDC's six-decimal rounding. The existing Ethereum and Arbitrum deployments should also be treated as having a known clock and call-frequency defect; agreement between them does not establish correctness.
