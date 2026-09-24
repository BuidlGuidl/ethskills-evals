# Fixed-rate accrual across Ethereum, Arbitrum, and Base

## 1. July reconciliation

The Arbitrum result is not nonsense because this contract is not counting
Arbitrum's fast L2 blocks.

On Arbitrum, `block.number` inside Solidity returns an estimate of the first
non-Arbitrum ancestor chain block number. For Arbitrum One, that means an
Ethereum L1 block number, not the Arbitrum child-chain block number. Arbitrum's
own docs call this out directly: `block.number` returns an approximate parent
chain block number, while the Arbitrum block number is available separately via
`ArbSys(100).arbBlockNumber()`.

So the Arbitrum deployment and the Ethereum deployment both advanced accrual at
roughly the Ethereum L1 block cadence. The Arbitrum deployment did not multiply
250 ms L2 blocks by 12 seconds.

The 3,391 USDC figure is also consistent with this block-count model. The rate
math for an exact 31-day wall-clock month is:

```text
1,000,000 * 4.00% * 31 / 365
= 3,397.2602739726 USDC
```

But the contract does not measure elapsed wall-clock seconds. It measures:

```text
secondsElapsed = (block.number - lastAccrualBlock) * 12
```

Ethereum has 12-second slots, but `block.number` only increments when a block is
actually produced. Skipped slots still consume wall-clock time, but they do not
increment `block.number`. A 3,391 USDC charge implies:

```text
counted seconds = 3,391 / (1,000,000 * 0.04) * 365 days
                = 2,673,464.4 seconds

counted blocks  = 2,673,464.4 / 12
                ~= 222,789 blocks

ideal 31-day blocks at 12 seconds/block
                = 2,678,400 / 12
                = 223,200 blocks

shortfall       ~= 411 blocks
                ~= 82 minutes of skipped/un-counted slot time
```

That explains both observations:

- Arbitrum matches mainnet because Arbitrum Solidity `block.number` tracks an
  Ethereum-parent block number, not the 250 ms Arbitrum block stream.
- Both are under the theoretical 3,397 USDC because the code counts produced
  blocks times 12 seconds, not actual elapsed seconds. Skipped Ethereum slots
  make the produced-block count slightly lower than wall-clock time divided by
  12.

## 2. What happens on Base

Base is different from Arbitrum for this purpose. Base is an OP Stack chain, and
its normal L2 block cadence is 2 seconds. The Base docs describe 2-second L2
blocks, with Flashblocks streaming 200 ms preconfirmations inside the standard
2-second block interval. Those Flashblocks are not a reason to keep the 12-second
constant; the important point is already enough: Base L2 blocks are about 2
seconds apart, not 12.

For the same 1,000,000 USDC debt over 31 days, assuming the current 2-second
Base block cadence:

```text
31 days                    = 2,678,400 seconds
Base blocks in 31 days      = 2,678,400 / 2
                            = 1,339,200 blocks

contract-counted seconds    = 1,339,200 * 12
                            = 16,070,400 seconds
                            = 186 days

interest                   = 1,000,000 * 0.04 * 16,070,400 / 31,536,000
                            = 20,383.5616438356 USDC
```

So on Base this code would charge about **20,384 USDC** for the month, roughly
**6x** the intended 3,397 USDC.

There is one deployment-timing caveat: Base documentation currently says
Flashblocks are planned to be deprecated in a future Denim hardfork and that
canonical 200 ms block behavior can be tested early on Vibenet. If canonical
200 ms blocks were live on Base mainnet before this contract deployed, the same
bug would be roughly **60x**, not 6x:

```text
31 days / 0.2 seconds       = 13,392,000 blocks
contract-counted seconds    = 13,392,000 * 12
                            = 160,704,000 seconds

interest                   = 203,835.6164383562 USDC
```

For Base mainnet as documented today, the expected failure mode is the 2-second
case: about 20,384 USDC.

## What I would change

Do not use `block.number` as a time source for interest. Store
`lastAccrualTimestamp` and accrue from `block.timestamp`:

```solidity
function accrueInterest() public {
    uint256 elapsed = block.timestamp - lastAccrualTimestamp;
    if (elapsed == 0) return;

    index += index * rateBps * elapsed / (10_000 * 365 days);
    lastAccrualTimestamp = block.timestamp;
}
```

That makes the bytecode portable across Ethereum, Arbitrum, Base, and future
block-time changes. I would also add chain-fork tests that simulate 12-second,
2-second, and sub-second block production and assert that 31 days at 4.00% on
1,000,000 USDC lands near 3,397 USDC, independent of block cadence.

Sources checked:

- Arbitrum docs, "Block gas limit, numbers and time"
  (https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/block-numbers-and-time):
  `block.number` in an Arbitrum contract returns an approximate first
  non-Arbitrum ancestor chain block number; Arbitrum child-chain block number is
  available via `ArbSys(100).arbBlockNumber()`.
- Arbitrum docs, "Solidity support"
  (https://docs.arbitrum.io/arbitrum-essentials/arbitrum-vs-ethereum/solidity-support):
  `block.number` differs from Ethereum by returning an estimate of the first
  non-Arbitrum ancestor chain block.
- Base docs, "Derivation"
  (https://docs.base.org/specifications/base-protocol/consensus/derivation):
  under a 2-second L2 block time, an Ethereum 12-second epoch typically contains
  `12/2 = 6` L2 blocks.
- Base docs, "Flashblocks"
  (https://docs.base.org/specifications/flashblocks): Flashblocks are 200 ms
  sub-block/preconfirmation updates within the standard 2-second full block
  interval, with a planned future move toward canonical 200 ms behavior.
