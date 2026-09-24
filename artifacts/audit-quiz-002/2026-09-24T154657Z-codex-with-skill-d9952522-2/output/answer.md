# Fixed-rate accrual on mainnet, Arbitrum, and Base

The July reconciliation is consistent with the code.

The surprising part is Arbitrum: the contract is not using Arbitrum's own fast L2 block number. In an Arbitrum smart contract, `block.number` returns an approximate Ethereum / parent-chain block number, not the Arbitrum child-chain block number. The child-chain block number is what advances quickly; `ArbSys(100).arbBlockNumber()` is the precompile path for that. So this code on Arbitrum effectively counted Ethereum-paced blocks, multiplied by the hard-coded 12 seconds per block, and therefore landed very close to mainnet.

The small shortfall versus the 3,397 USDC rate expectation is the other side of the same issue. The 3,397 number is:

```text
1,000,000 * 4.00% * 31 days / 365 days
= 1,000,000 * 0.04 * 2,678,400 / 31,536,000
= 3,397.26 USDC
```

But the contract does not measure 2,678,400 real seconds. It measures:

```text
(block.number - lastAccrualBlock) * 12
```

Ethereum execution block numbers do not represent every 12-second wall-clock slot perfectly. Missed slots, endpoint cutoffs, start/end block selection, and integer truncation mean the block-count-derived elapsed time can be a little under 31 days. The observed 3,391 USDC corresponds to:

```text
3,391 / 1,000,000 / 0.04 * 31,536,000
= 2,673,464.4 seconds
= 222,788.7 assumed 12-second blocks
```

An exact 31-day month would be:

```text
2,678,400 / 12 = 223,200 blocks
```

So the observed shortfall is about 411 fewer assumed blocks, or about 4,936 seconds of contract time, roughly 1 hour 22 minutes. That is why both chains came in around 3,391 instead of 3,397.

## What happens on Base

Base is different from Arbitrum. Base is OP Stack, and `block.number` advances as the Base L2 block number. Today Base's canonical L2 block cadence is 2 seconds, with Flashblocks providing 200 ms preconfirmations inside the 2-second block. Under that current canonical behavior, 31 days contains:

```text
31 * 24 * 60 * 60 / 2 = 1,339,200 Base blocks
```

The contract then multiplies those blocks by 12:

```text
1,339,200 * 12 = 16,070,400 assumed seconds
16,070,400 seconds = 186 days
```

So, for 1,000,000 USDC over 31 real days, ignoring small compounding and rounding effects:

```text
1,000,000 * 0.04 * 16,070,400 / 31,536,000
= 20,383.56 USDC
```

That is exactly 6x the intended 3,397.26 USDC because the code assumes each block is 12 seconds while Base's canonical blocks are 2 seconds.

There is also a timing risk for "next month." Base's Denim upgrade is currently planned for October 2026, but the official docs say the exact Base Mainnet activation timestamp is still TBD. Denim changes Base from one canonical block every 2 seconds to five canonical blocks per second, i.e. 200 ms native blocks. If this contract runs for a full 31 days after Denim activation, then:

```text
31 * 24 * 60 * 60 / 0.2 = 13,392,000 Base blocks
13,392,000 * 12 = 160,704,000 assumed seconds
160,704,000 seconds = 1,860 days

1,000,000 * 0.04 * 160,704,000 / 31,536,000
= 203,835.62 USDC
```

That is 60x the intended monthly interest. If the month straddles the Denim activation, the result is a weighted blend: about 6x intended interest for the pre-Denim days and about 60x intended interest for the post-Denim days.

If `accrueInterest()` is called many times during the month, the index also compounds slightly. That is secondary to the chain-cadence error. For example, with every-block accrual and no integer truncation, the current 2-second Base case is about 20,593 USDC instead of 20,384 USDC. The material problem is still the block-to-time conversion.

## What I would change

Do not deploy this unchanged to Base.

For interest accrual, measure elapsed time with timestamps:

```solidity
uint256 elapsed = block.timestamp - lastAccrualTimestamp;
if (elapsed == 0) return;
index += index * rateBps * elapsed / (10_000 * 365 days);
lastAccrualTimestamp = block.timestamp;
```

That makes the rate a rate per second, which is what finance intends, and it avoids chain-specific block cadence assumptions. I would also rename the stored checkpoint from `lastAccrualBlock` to `lastAccrualTimestamp`, add migration/backfill logic for existing deployments, and add tests that simulate Ethereum 12-second blocks, Base 2-second blocks, Base 200 ms blocks, and Arbitrum's parent-chain `block.number` behavior.

If the business wants simple fixed-rate interest rather than compounding between calls, do not update `index` multiplicatively on every accrual. Track principal and accumulated simple interest over timestamp elapsed time, or define explicitly that this is a continuously/periodically compounded borrow index.

Sources checked:

- Arbitrum docs, "Block gas limit, numbers and time": https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time
- Base docs, "Derivation": https://docs.base.org/specifications/base-protocol/consensus/derivation
- Base docs, "200ms Native Blocks": https://docs.base.org/upgrades/denim/200ms-blocks
