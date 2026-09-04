# Interest-clock review: Ethereum, Arbitrum One, and Base

## Bottom line

Arbitrum did not charge at its roughly 250 ms sequencing cadence because, on Arbitrum, Solidity's `block.number` is an approximate **Ethereum L1 block number**, not the Arbitrum L2 block number. The contract therefore used substantially the same clock on Ethereum and Arbitrum. Offchain Labs' published material confirms this distinction between `block.number` and `ArbSys.arbBlockNumber()`.

Base is different. On Base, `block.number` is the Base L2 block number and sealed L2 blocks are two seconds apart. A contract which treats every Base block as 12 seconds therefore advances its interest clock approximately six times too fast. On 1,000,000 USDC over 31 days, it will charge approximately **20,384 to 20,593 USDC**, depending on how often `accrueInterest()` is called, rather than 3,397 USDC.

I would not deploy this bytecode to Base. I would replace block-count timekeeping with timestamp-delta timekeeping and explicitly define the intended compounding and rounding behavior.

## 1. July reconciliation

The finance figure is the simple-interest calculation:

```text
1,000,000 × 0.04 × 31 / 365 = 3,397.260274 USDC
```

### Why Arbitrum agreed with Ethereum

Arbitrum's EVM gives special meaning to the `NUMBER` opcode used by Solidity's `block.number`: on Arbitrum One it reports an approximate parent-chain (Ethereum) block number. The native Arbitrum L2 height is a separate value exposed by `ArbSys(100).arbBlockNumber()`. See the [Offchain Labs-hosted chain-specific review](https://docs.arbitrum.io/assets/files/2025-12-offchain-arbitrum-chains-genesis-generator-securityreview-ecc17bd8f262c11ea3c8fd6458ff271e.pdf).

Consequently, this line on Arbitrum:

```solidity
secondsElapsed = (block.number - lastAccrualBlock) * 12;
```

counts approximate Ethereum blocks and assigns 12 seconds to each, just as the mainnet deployment does. The much faster Arbitrum sequencing cadence is irrelevant to this calculation. Arbitrum may expose the same L1 number to many L2 transactions and then advance it in jumps; over a month, however, its delta tracks approximately the same L1-height delta as Ethereum. That explains agreement within a few dollars. The deployments being a day apart does not change the per-deployment rate; only the two endpoint block numbers and intervening calls matter.

### Why both were a little below 3,397

`block.number × 12` is not elapsed time, even on Ethereum. Twelve seconds is the duration of a beacon-chain slot, but missed slots do not create execution blocks or increment the EVM block number. Reconciliation cutoffs also need not fall exactly on block boundaries. Arbitrum's approximate L1 block number introduces an additional endpoint lag/coarseness. Thus the code can account for fewer nominal seconds than 31 wall-clock days.

The observed 3,391 USDC corresponds, under a single simple accrual, to:

```text
implied days = (3,391 / 1,000,000) / 0.04 × 365
             = 30.942875 days

shortfall from 31 days = 1.371 hours
equivalent 12-second blocks = about 411
```

There is an important qualification: the supplied facts do not uniquely prove which missed blocks, cutoff effects, or call schedule produced the exact six-dollar difference. The function updates the index multiplicatively, so repeated calls compound:

```text
new index = old index × (1 + 0.04 × nominalElapsed / year)
```

With very frequent accrual, a perfect 31-day clock would produce about 3,403.04 USDC, not 3,397.26. Relative to that limit, a 3,391 result implies about 30.8905 accounted days, or a 2.63-hour clock shortfall. The real answer lies between the single-call and frequent-call cases according to the actual transaction history. Integer division always rounds each index increment down and may subtract some additional dust, but whether that is material depends on the index's scale and the number of calls; it cannot be quantified from this excerpt. It should not be casually attributed the whole six dollars.

So the reconciliation is consistent with the implementation, but the exact attribution should be confirmed from each deployment's `Accrue` call blocks (or state transitions), beginning and ending block numbers, and index precision.

## 2. What the same code does on Base

Base is an OP Stack chain. Its `block.number` is the L2 height, and its protocol specifies a **2-second L2 block time**. Base's derivation documentation states both that each L2 block timestamp advances by `l2_block_time` and that this interval is 2 seconds on Base; it also notes that roughly six L2 blocks ordinarily fit in one 12-second Ethereum slot. See [Base's derivation specification](https://docs.base.org/specifications/base-protocol/consensus/derivation).

Over 31 days:

```text
wall-clock seconds       = 31 × 86,400 = 2,678,400
approximate Base blocks  = 2,678,400 / 2 = 1,339,200
contract-accounted time  = 1,339,200 × 12 = 16,070,400 seconds
                         = 186 days
```

The contract therefore applies approximately six times the intended time.

If interest is accrued only once at the end, the function is linear for that call:

```text
interest = 1,000,000 × 0.04 × 186 / 365
         = 20,383.561644 USDC
```

If someone calls once per day, daily compounding produces approximately:

```text
1,000,000 × ((1 + 0.04 × 6 / 365)^31 - 1)
= 20,585.89 USDC
```

In the limit of very frequent calls, the result approaches:

```text
1,000,000 × (exp(0.04 × 186 / 365) - 1)
= 20,592.73 USDC
```

Accordingly, a realistic headline is **about 20.4k–20.6k USDC**, roughly six times the intended monthly interest. The precise charge is call-schedule-dependent. Base Flashblocks may provide sub-block preconfirmations at a faster cadence, but they do not make the sealed EVM block height advance at that cadence; the applicable protocol block time here is two seconds, not 250 ms.

## Recommended change

Use elapsed timestamps:

```solidity
uint256 public lastAccrualTimestamp;

function accrueInterest() public {
    uint256 elapsed = block.timestamp - lastAccrualTimestamp;
    if (elapsed == 0) return;

    index += Math.mulDiv(index, rateBps * elapsed, 10_000 * 365 days);
    lastAccrualTimestamp = block.timestamp;
}
```

This removes the chain-specific block-time assumption. It also naturally accounts for missed Ethereum slots. Use a full-precision `mulDiv` implementation and a deliberately chosen rounding direction; ensure the multiplication of `rateBps * elapsed` is bounded or arrange the operands to avoid overflow.

Two further design decisions should be made explicit before deployment:

1. **Simple versus compounded rate.** The existing index compounds whenever `accrueInterest()` is called, which lets arbitrary callers influence the effective rate through call frequency. If 4.00% means continuously compounded, per-second compounded, or APR with a specified compounding convention, encode that convention so public call frequency cannot change economics. If it means simple APR, accrue against a non-compounding principal/base index or otherwise make the result path-independent.
2. **Migration and validation.** Changing the clock field requires a migration plan for existing deployments. Initialize the timestamp from a controlled migration point, test long gaps and multiple calls in one block, and compare Ethereum, Arbitrum, and Base tests against the same timestamp trace. Do not substitute Arbitrum's native `arbBlockNumber()`—that would merely exchange one chain-specific cadence for another.

Until that change is deployed and the intended compounding convention is settled, deployment of the existing bytecode to Base should be blocked.
