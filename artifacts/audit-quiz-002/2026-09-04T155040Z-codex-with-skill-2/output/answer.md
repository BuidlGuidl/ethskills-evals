# Fixed-rate accrual reconciliation and Base deployment

## Conclusion

Do **not** deploy this bytecode unchanged to Base. The agreement between Ethereum and Arbitrum is explained by a chain-specific opcode semantic: on Arbitrum One, Solidity's `block.number` reports an approximate Ethereum L1 block number, not Arbitrum's much faster L2 block number. Base follows normal OP Stack behavior and exposes the L2 block number, whose blocks are spaced two seconds apart. Consequently, the hard-coded assumption of 12 seconds per block makes interest on Base run at approximately **6× real time**.

## 1. July: why Ethereum and Arbitrum agree

The nominal simple-interest calculation is:

```
1,000,000 × 0.04 × 31 / 365 = 3,397.260274 USDC
```

Arbitrum's roughly 250 ms sequencing cadence is irrelevant to this contract. On Arbitrum, the EVM `NUMBER` opcode used by `block.number` returns the approximate L1 block number. Arbitrum provides the separate `ArbSys.arbBlockNumber()` method when a contract actually wants the L2 block number ([Arbitrum ArbSys documentation](https://docs.arbitrum.io/for-devs/dev-tools-and-resources/partials/precompile-tables/_ArbSys); the chain-specific `NUMBER` behavior is also described in this [Arbitrum security review](https://docs.arbitrum.io/assets/files/2025-12-offchain-arbitrum-chains-genesis-generator-securityreview-ecc17bd8f262c11ea3c8fd6458ff271e.pdf)). Thus both deployments are effectively counting Ethereum blocks and multiplying that count by 12 seconds. A one-day difference in deployment date does not affect the rate over a later 31-day holding interval.

The approximately 6 USDC shortfall is consistent with the fact that `blocksElapsed × 12` is only an estimate of elapsed wall-clock time:

- Ethereum has 12-second *slots*, but missed slots produce no block and therefore no increment of `block.number`. The code loses 12 seconds of interest for every missed slot. The observed 3,391 USDC corresponds, on a simple-interest basis, to only about 30.9428 days—roughly 1.37 hours less than 31 days, or about 411 missing 12-second block intervals.
- Every Solidity integer division rounds down. Each `accrueInterest()` call therefore discards a remainder. The size of this effect depends on the scale used for `index` and on how often accrual was called.
- Each call applies interest to the already increased index, so multiple calls also introduce compounding, which pushes in the opposite direction. For perspective, continuous compounding over the month would raise 3,397.26 to about 3,403.04 USDC before accounting for missed blocks and rounding.

Therefore the supplied facts explain the direction and the cross-chain agreement, but they are not enough to reproduce **exactly** 3,391: exact reconciliation requires the first and last accrual block numbers, every intervening accrual call, the index's fixed-point scale, and the debt-to-USDC rounding path. The observed figure should not be attributed solely to integer truncation without those data.

## 2. What happens on Base

Base is an OP Stack L2. Its sealed L2 blocks have two-second timestamp spacing; OP Stack derivation requires each L2 timestamp to advance by `l2_block_time`, and documents a two-second L2 block time ([Base derivation specification](https://docs.base.org/base-chain/specs/protocol/consensus/derivation); [OP Stack glossary](https://docs.optimism.io/op-stack/reference/glossary)). Unlike Arbitrum, `block.number` is the L2 block number.

Over 31 days, assuming uninterrupted two-second blocks:

```
real seconds             = 31 × 86,400 = 2,678,400
Base blocks              = 2,678,400 / 2 = 1,339,200
contract secondsElapsed  = 1,339,200 × 12 = 16,070,400
                         = 186 contract-days = 6 × 31 real days

simple interest          = 1,000,000 × 0.04 × 186 / 365
                         = 20,383.561644 USDC
```

That **20,383.56 USDC** is the result if the whole interval is accrued in one call (apart from integer rounding). Because the function updates `index`, the exact result depends on call frequency:

- one accrual at the end: about **20,383.56 USDC**;
- one accrual per day: about **20,585.89 USDC**;
- the limiting, near-continuous-compounding result: about **20,592.73 USDC**.

So a realistic answer is approximately **20.4k–20.6k USDC**, not 3,397 USDC, with the exact figure determined by actual Base blocks, accrual calls, and rounding. Public callers can affect the compounding/rounding schedule, so this nondeterminism is itself undesirable.

## Recommendation

Replace block-count timekeeping with timestamps:

```solidity
function accrueInterest() public {
    uint256 elapsed = block.timestamp - lastAccrualTimestamp;
    if (elapsed == 0) return;

    index += index * rateBps * elapsed / (10_000 * 365 days);
    lastAccrualTimestamp = block.timestamp;
}
```

Use a full-precision `mulDiv` implementation and document the intended rounding direction. Also decide explicitly whether 4.00% is simple interest or an effective/nominal compounded rate. The shown incremental formula compounds at a caller-influenced frequency; if identical economic results are required regardless of call cadence, compute the index from a fixed epoch using an explicit linear formula, or use a vetted fixed-point exponentiation model with a precisely specified annual-rate convention.

Before migration, test Ethereum, Arbitrum, and Base against elapsed timestamps, missed blocks, long inactivity, frequent accrual calls, and the actual USDC/index decimal scales. Existing deployments need a migration or upgrade plan rather than merely changing the keeper's call cadence.
