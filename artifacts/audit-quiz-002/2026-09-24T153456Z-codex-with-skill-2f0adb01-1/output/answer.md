# Fixed-rate accrual across Ethereum, Arbitrum, and Base

## 1. July reconciliation

The Arbitrum result matched mainnet because this contract is not using the
Arbitrum L2 block number.

On Arbitrum, Solidity `block.number` returns an approximate block number of
the first non-Arbitrum ancestor chain. For Arbitrum One, that ancestor is
Ethereum. The Arbitrum docs distinguish that from the child-chain block number,
which is available through `ArbSys(100).arbBlockNumber()` and through normal RPC
receipt fields:

https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time

So this code:

```solidity
uint256 blocksElapsed = block.number - lastAccrualBlock;
uint256 secondsElapsed = blocksElapsed * 12;
```

accidentally uses an Ethereum-ish 12-second block clock on both Ethereum
mainnet and Arbitrum One. It does not multiply by the roughly 250ms Arbitrum
child-chain block cadence.

The reason both were a little under the pure 31-day rate result is that
Ethereum `block.number` counts produced blocks, not elapsed 12-second slots.
If a slot is missed, 12 seconds of wall-clock time pass, but there is no
additional block number. The contract therefore ignores missed slots.

For 1,000,000 USDC at 4.00% APR over 31 days, the time-based result is:

```text
31 days = 2,678,400 seconds
interest = 1,000,000 * 0.04 * 2,678,400 / 31,536,000
         = 3,397.260273 USDC
```

The observed 3,391 USDC corresponds to about:

```text
interest per 12-second counted block
  = 1,000,000 * 0.04 * 12 / 31,536,000
  = 0.015220700 USDC

3,391 / 0.015220700
  ~= 222,789 counted blocks
```

A perfect 31-day span at 12 seconds per block would be:

```text
2,678,400 / 12 = 223,200 blocks
```

So the reconciliation implies roughly:

```text
223,200 - 222,789 ~= 411 missed counted blocks
411 * 12 ~= 4,932 seconds ~= 82 minutes
```

That is why mainnet lands around 3,391 instead of 3,397, and Arbitrum lands in
the same neighborhood: both deployments are effectively keying off the same
Ethereum block-number clock, with small differences from Arbitrum's approximate
L1-block-number semantics and integer truncation.

## 2. What happens on Base

Base is different. Base does not have Arbitrum's special Solidity
`block.number` behavior. The contract will count Base L2 blocks.

Base's current production cadence is one canonical block every 2 seconds.
Base's documented Denim upgrade, currently listed as planning for October 2026
on Sepolia and Mainnet, moves Base to native 200ms canonical blocks. The Base
docs also say Denim moves block production from one canonical block every two
seconds to five complete canonical blocks per second, while EVM
`block.timestamp` remains seconds-based:

https://docs.base.org/upgrades/denim/overview

https://docs.base.org/upgrades/denim/200ms-blocks

If the 31-day period is entirely before Denim, Base produces about:

```text
2,678,400 seconds / 2 seconds per block = 1,339,200 blocks
```

The contract treats those as 12 seconds each:

```text
secondsElapsed = 1,339,200 * 12 = 16,070,400 seconds
```

So it charges:

```text
interest = 1,000,000 * 0.04 * 16,070,400 / 31,536,000
         = 20,383.561643 USDC
```

That is 6x the intended 3,397.260273 USDC.

If the 31-day period is entirely after Denim's 200ms native blocks are active,
Base produces about:

```text
2,678,400 seconds * 5 blocks per second = 13,392,000 blocks
```

The contract treats those as:

```text
secondsElapsed = 13,392,000 * 12 = 160,704,000 seconds
```

So it charges:

```text
interest = 1,000,000 * 0.04 * 160,704,000 / 31,536,000
         = 203,835.616438 USDC
```

That is 60x the intended 3,397.260273 USDC.

If the period straddles the Denim activation, the overcharge is prorated:

```text
charged time = 6 * pre-Denim real seconds + 60 * post-Denim real seconds
```

## Recommendation

Do not deploy this accounting to Base unchanged.

More broadly, do not use `block.number * assumed seconds per block` for interest
or any other wall-clock financial accounting. The code only looked portable on
Arbitrum because Arbitrum's Solidity `block.number` is unusual.

Use timestamp deltas instead:

```solidity
uint256 elapsed = block.timestamp - lastAccrualTimestamp;
if (elapsed == 0) return;
index += index * rateBps * elapsed / (10_000 * 365 days);
lastAccrualTimestamp = block.timestamp;
```

For production, I would also consider capping `elapsed` per accrual call or
using a reviewed fixed-point math library, depending on how the rest of the
borrow index is implemented. But the essential fix is to accrue by elapsed time,
not by block count.
