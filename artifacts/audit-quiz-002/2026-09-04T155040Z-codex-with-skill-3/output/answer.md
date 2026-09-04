# Fixed-rate accrual across Ethereum, Arbitrum, and Base

## Conclusion

Arbitrum matched Ethereum because Solidity's `block.number` on Arbitrum One is not the fast-moving Arbitrum L2 block height. It reports an approximate Ethereum L1 block number. Consequently, multiplying its change by 12 seconds accidentally gives roughly the same elapsed-time estimate as it does on Ethereum.

Base is different. On Base, `block.number` is the L2 block number, and Base produces an L2 block every 2 seconds. The contract will count each of those blocks as 12 seconds, so its clock will run approximately **6x too fast** and it will materially overcharge borrowers.

## 1. July reconciliation

The stated simple-interest expectation is:

```text
1,000,000 * 4.00% * 31 / 365
= 3,397.260274 USDC
```

On Ethereum, `block.number` advances once for each block actually produced. With a nominal 12-second slot, the code approximates elapsed time as:

```text
(ending block - starting block) * 12 seconds
```

On Arbitrum One, many fast L2 blocks/transactions can share the same Solidity `block.number`; that value tracks the approximate L1 block number. Therefore the same formula still approximates L1/Ethereum time, not `250 ms * Arbitrum blocks`. That is why the Arbitrum deployment did not charge tens of times too much and why its result closely followed mainnet. Arbitrum's separate `ArbSys.arbBlockNumber()` is the API for its actual L2 block height.

The reported 3,391 USDC corresponds, under the contract's linear formula, to:

```text
effective days = 3,391 * 365 / (1,000,000 * 0.04)
               = 30.942875 days

shortfall versus 31 days = 0.057125 days
                           = 4,935.6 seconds
                           = about 82 minutes
                           = about 411 nominal 12-second blocks
```

That small shortfall is consistent with the contract measuring block-height distance rather than the exact wall-clock interval: the reconciliation calls may not have bracketed exactly 31 days; Ethereum can have missed 12-second slots, for which wall time advances but block height does not; and Arbitrum's exposed L1 number is only an approximate/current L1 reference. Solidity division also rounds each index increment down, although with a conventionally high-precision index that normally contributes only tiny dust, not six whole USDC.

The precise allocation among those causes cannot be proven from the quoted totals alone. It requires the two accrual transaction block numbers/timestamps, every intervening `accrueInterest()` call, and the index's scale. The equal rounded totals are plausible, but should not be read as proof that block-based timekeeping is portable.

There is a second, independent issue: each call applies the rate to the already-increased `index`. Calls therefore compound interest. Because anyone may call the function, the effective charge depends on call frequency. The 3,397 figure is simple interest (or one update covering the whole interval); repeated updates make the theoretical charge slightly higher, while block-time undercount and boundary timing can more than offset that, as they evidently did here.

## 2. What happens on Base

Base specifies a 2-second L2 block time and exposes the L2 height as `block.number`. Over an exact 31 days:

```text
actual Base blocks = 31 * 86,400 / 2
                   = 1,339,200 blocks

seconds credited by this contract = 1,339,200 * 12
                                    = 16,070,400 seconds
                                    = 186 days
```

If accrual occurs only once at the end, the charge is:

```text
1,000,000 * 0.04 * 186 / 365
= 20,383.561644 USDC
```

So the clean one-accrual answer is **about 20,384 USDC**, six times the intended simple-interest amount of 3,397 USDC.

That is the minimum idealized result for this 31-day interval, not a unique exact production result, because additional calls compound the index. For illustration:

```text
one accrual after 31 days:       20,383.56 USDC
accrual once per day:            20,585.89 USDC
very frequent accrual (limit):   20,592.73 USDC
```

Integer rounding may shave small amounts from those figures. Actual Base block/time boundaries and the exact call schedule also affect the result, but none cures the approximately 6x clock error.

## Recommended change

Do **not** deploy this implementation unchanged to Base.

Use elapsed timestamps, not a hard-coded seconds-per-block assumption:

```solidity
uint256 elapsed = block.timestamp - lastAccrualTimestamp;
// update index using elapsed
lastAccrualTimestamp = block.timestamp;
```

Then explicitly define the financial convention and make the result independent of who calls and how often:

- If 4.00% means simple APR, compute cumulative interest from a fixed principal/index baseline and total elapsed time, rather than repeatedly applying a linear increment to the latest index.
- If compounding is intended, choose a fixed compounding convention (for example per-second compounding) and calculate the index from elapsed time with a vetted fixed-point exponentiation routine. Do not let arbitrary keeper frequency select the effective rate.
- Use full-precision `mulDiv`-style arithmetic, document rounding direction, and test Ethereum, Arbitrum, and Base against the same timestamp intervals, including many calls versus one call.

`block.timestamp` is the appropriate cross-chain clock for this long-duration accounting. It is not perfectly manipulation-free, particularly on sequenced L2s, but timestamp discretion is tiny relative to a month and is vastly safer here than assuming a universal block duration. If deployment bytecode truly must remain identical, timestamp-based logic supports that; only chain IDs and external addresses should remain deployment configuration.

Sources: [Base derivation specification (2-second L2 blocks)](https://docs.base.org/specifications/base-protocol/consensus/derivation), [Arbitrum documentation: differences from Ethereum](https://docs.arbitrum.io/how-arbitrum-works/inside-arbitrum-nitro#differences-from-ethereum).
