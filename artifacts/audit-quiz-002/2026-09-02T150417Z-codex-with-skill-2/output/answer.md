# Recommendation

Do **not** deploy this bytecode unchanged to Base. The July agreement between Ethereum and Arbitrum is real but accidental: on Arbitrum One, Solidity's `block.number` follows Ethereum's block number, whereas on Base it is Base's own L2 block number.

## 1. July reconciliation

The rate-only, simple-interest benchmark is:

```text
1,000,000 * 4% * 31 / 365 = 3,397.260274 USDC
```

The surprising Arbitrum result comes from Arbitrum's nonstandard `NUMBER` opcode semantics. `block.number` on Arbitrum One returns the block number of its first non-Arbitrum parent—Ethereum—not the roughly 250 ms Arbitrum block number. Arbitrum exposes its own L2 number separately through `ArbSys.arbBlockNumber()`. This is confirmed by the [Arbitrum-hosted review of the opcode behavior](https://docs.arbitrum.io/assets/files/2025-12-offchain-arbitrum-chains-genesis-generator-securityreview-ecc17bd8f262c11ea3c8fd6458ff271e.pdf) and the [official ArbSys interface](https://github.com/OffchainLabs/nitro-precompile-interfaces/blob/main/ArbSys.sol).

Consequently, both deployments are effectively doing this:

```text
observed Ethereum blocks * 12 seconds/block
```

They are not counting Arbitrum's sub-second L2 blocks. Multiple Arbitrum transactions can see the same Ethereum-derived `block.number`, so the Arbitrum calculation naturally tracks mainnet.

The small undercharge is also explained by using produced Ethereum blocks as a clock. Ethereum has 12-second *slots*, but a skipped slot consumes 12 seconds of real time without producing a block or incrementing `block.number`. Accrual endpoints need not fall exactly on the July boundaries either. In addition, every Solidity division in the update rounds down.

As a useful reconciliation check, if the period were accrued in one step, 3,391 USDC corresponds to:

```text
counted time  = 3,391 / (1,000,000 * 4%) * 365 days
              = 30.942875 days

counted blocks ~= 30.942875 * 86,400 / 12
               ~= 222,789 blocks

perfect 31-day count = 31 * 86,400 / 12
                     = 223,200 blocks

difference ~= 411 blocks ~= 82 minutes
```

That is consistent with skipped slots plus boundary/rounding effects, and Arbitrum inherits approximately the same Ethereum block progression.

There is one important qualification: **3,391 cannot be reproduced exactly from the snippet and the rounded finance result alone.** The update applies interest to the already-grown `index`, so multiple calls compound, while each call also truncates. The exact answer requires the start/end block values, every intervening `accrueInterest()` call, the index precision, and Finance's final rounding. Compounding pushes the result upward; skipped blocks and truncation push it downward. The figures show that the latter effects won in July.

## 2. What happens on Base

Base has approximately two-second canonical L2 blocks, and `block.number` is that L2 block number. Its 200 ms Flashblocks are incremental preconfirmations within a canonical block, not ten new values of `block.number`; see Base's [transaction troubleshooting documentation](https://docs.base.org/base-chain/network-information/troubleshooting-transactions) and [Flashblocks FAQ](https://docs.base.org/base-chain/flashblocks/faq).

Assuming the current two-second cadence:

```text
actual 31-day seconds = 31 * 86,400
                      = 2,678,400 seconds

Base blocks           = 2,678,400 / 2
                      = 1,339,200 blocks

seconds assumed by code = 1,339,200 * 12
                        = 16,070,400 seconds
                        = 186 days
```

If there is a single accrual covering the whole period:

```text
interest = 1,000,000 * 4% * 186 / 365
         = 20,383.561644 USDC
```

That is exactly six times the 3,397.260274 USDC simple-interest benchmark, because the code treats every two seconds as twelve seconds.

It is not possible to give one exact Base charge without specifying call cadence. Because the function compounds the index, more calls generally mean more interest (subject to integer truncation):

| Accrual cadence | Approximate 31-day interest |
|---|---:|
| One call spanning the month | 20,383.56 USDC |
| Once per day | 20,585.89 USDC |
| Every block / continuous limit | 20,592.73 USDC |

Thus the operational expectation is roughly **20.4k–20.6k USDC**, rather than 3.4k, under the stated assumptions. Actual Base block gaps, transaction timing, and fixed-point truncation will move the exact result slightly.

## What I would change

Replace block-count timekeeping with elapsed timestamps:

```solidity
uint256 elapsed = block.timestamp - lastAccrualTimestamp;
// calculate the intended interest factor from elapsed
lastAccrualTimestamp = block.timestamp;
```

For month-scale interest, `block.timestamp` is the appropriate portable EVM clock; minor sequencer/validator timestamp latitude is negligible compared with the deterministic sixfold Base error.

I would also remove caller-cadence dependence. First decide and document whether 4.00% means simple APR or a compounded rate:

- For simple APR, calculate the index/debt from a fixed checkpoint index and the **total elapsed time since that checkpoint**. Do not reset the interest base on every public call.
- If compounding is intended, use a deterministic time-based power/factor based on total elapsed seconds, so splitting the same interval into many calls produces the same result.

Use high-precision `mulDiv` arithmetic with an explicit rounding policy, and accrue before every borrow, repay, close, health check, and liquidation. Tests should assert the same outcome across mainnet, Arbitrum, and Base; across skipped blocks; and across different partitions of the same elapsed interval. Switching Arbitrum to `arbBlockNumber()` while keeping `12 seconds/block` would be the wrong fix—it would create the very overcharge that did not occur in July.
