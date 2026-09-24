# Fixed-rate borrowing reconciliation

The Arbitrum result is not evidence that the code is portable. It is evidence
that this particular assumption is accidentally L1-shaped on Arbitrum.

## 1. Why July matched on mainnet and Arbitrum

The contract does not measure elapsed wall-clock time. It measures:

```solidity
block.number delta * 12 seconds
```

On Ethereum mainnet that is only an approximation. Post-merge Ethereum has
12-second slots, but not every slot contains a block. `block.number` advances
only when a block is actually produced, so skipped slots make
`blocksElapsed * 12` slightly less than real elapsed time.

For a full 31-day July, the rate-only simple-interest expectation is:

```text
1,000,000 * 4.00% * 31 / 365 = 3,397.2602739726 USDC
```

The observed charge of about `3,391 USDC` corresponds to:

```text
3,391 / 1,000,000 / 0.04 * 365 = 30.942875 days
```

That is about `0.057125 days`, or `4,935.6 seconds`, short of 31 days. At
12 seconds per block, that is about `411.3` missing blocks/slots:

```text
31 days * 86,400 / 12 = 223,200 ideal 12-second blocks
observed effective blocks ~= 222,789
shortfall ~= 411 blocks
```

So the mainnet undercharge is the normal consequence of treating produced
blocks as elapsed 12-second slots. Integer truncation and the exact
`accrueInterest()` call boundaries can move the final USDC amount by a little
more, but the direction is the same: using `block.number` undercounts time
whenever Ethereum has skipped slots.

Arbitrum matched because Solidity `block.number` on Arbitrum is not the fast
Arbitrum L2 block height. In-contract `block.number` is approximately the
Ethereum L1 block number associated with the transaction. Arbitrum's own L2
block number is available separately through the `ArbSys(0x64)` precompile
(`arbBlockNumber()`), but this contract does not call it. That means the
contract used an L1-correlated block clock on Arbitrum and therefore accrued
almost the same as mainnet. The 250 ms Arbitrum block cadence did not enter the
calculation.

Sources:

- Arbitrum docs/security review material describes `block.number` on Arbitrum
  as the first non-Arbitrum parent chain block number, with `arbBlockNumber()`
  as the distinct Arbitrum L2 block number:
  https://docs.arbitrum.io/assets/files/2025-12-offchain-arbitrum-chains-genesis-generator-securityreview-ecc17bd8f262c11ea3c8fd6458ff271e.pdf
- The `ArbSys` precompile interface documents `arbBlockNumber()` as the
  Arbitrum block number distinct from the L1 block number:
  https://github.com/OffchainLabs/nitro-precompile-interfaces/blob/main/ArbSys.sol

## 2. What happens on Base

Base is an OP Stack chain. Its docs specify a 2-second L2 block time, and OP
Stack chains expose the L2 block number through `block.number`. So on Base this
code will count Base L2 blocks, then multiply each one by the hardcoded
mainnet assumption of 12 seconds.

For the same 31-day debt:

```text
real elapsed seconds = 31 * 86,400 = 2,678,400
Base blocks at 2 seconds/block = 2,678,400 / 2 = 1,339,200
contract secondsElapsed = 1,339,200 * 12 = 16,070,400
```

That is six times the real elapsed time:

```text
16,070,400 / 2,678,400 = 6
```

If interest is accrued once for the period, the charge is:

```text
1,000,000 * 400 * 16,070,400 / (10,000 * 365 days)
= 20,383.5616438356 USDC
```

With whole-USDC display, that is about `20,383 USDC`, versus the intended
`3,397 USDC`.

If `accrueInterest()` is called very frequently, the `index += ...` update
compounds the index. At one accrual per Base block, the same 31-day interval
would be approximately:

```text
1,000,000 * ((1 + 0.04 * 12 / 31,536,000) ^ 1,339,200 - 1)
~= 20,592.73 USDC
```

So the practical Base result is not just "a shade off"; it is roughly 6x the
intended simple-interest accrual, plus a smaller compounding effect depending
on how often the public function is called.

Sources:

- Base's protocol docs state that `l2_block_time` is 2 seconds on Base:
  https://docs.base.org/specifications/base-protocol/consensus/derivation
- OP Stack configurability docs describe L2 block time as a chain parameter
  constrained to 1 or 2 seconds for standard chains:
  https://specs.optimism.io/protocol/configurability.html

## Recommendation

Do not deploy this bytecode unchanged to Base.

For interest, use elapsed time directly:

```solidity
uint256 secondsElapsed = block.timestamp - lastAccrualTimestamp;
```

Store `lastAccrualTimestamp`, update it after accrual, and delete the
chain-specific `SECONDS_PER_BLOCK` assumption. `block.timestamp` is the right
primitive for month-scale interest accounting; small sequencer or validator
timestamp wiggle is immaterial at a 4% annual rate, while a hardcoded block
cadence is materially wrong across chains.

I would also make the rate math's rounding policy explicit. For borrower debt,
decide whether fractional interest rounds down, rounds up, or is retained in a
higher-precision index and only rounded at settlement. The important fix,
though, is to stop using `block.number` as a clock.
