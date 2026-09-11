# Interest-accrual review

## Conclusion

The Arbitrum result is not evidence that `12 seconds per block` is portable. It happens to work there because, in Arbitrum Solidity, `block.number` returns an Ethereum L1 block number rather than Arbitrum's much faster native L2 block number. Thus the mainnet and Arbitrum deployments both effectively counted Ethereum blocks and naturally produced nearly the same July charge.

Base is different. Base produces numbered L2 blocks every two seconds. With `SECONDS_PER_BLOCK = 12`, the contract will treat each real second as about six seconds and accrue at roughly six times the intended rate.

## July reconciliation

The rate-only, simple-interest calculation is

```
$1,000,000 * 0.04 * 31 / 365 = $3,397.260274
```

On Ethereum, however, `blocksElapsed * 12` is not elapsed time. Twelve seconds is the slot duration, but `block.number` advances only when a block is actually produced. A skipped slot consumes 12 seconds of wall-clock time without increasing the block number. Accrual calls also need not fall exactly on the reconciliation period's wall-clock boundaries. Consequently, the code can represent slightly less than 31 days.

A $3,391 simple-interest charge corresponds to

```
implied seconds = 3,391 / (1,000,000 * 0.04) * 365 days
                = 2,673,464.4 seconds
                = 30.942875 days

calendar seconds = 31 days = 2,678,400 seconds
difference        = 4,935.6 seconds, or about 411 twelve-second slots
```

That last comparison uses the displayed whole-dollar charge, so it is only indicative. Exact reconciliation requires the two `lastAccrualBlock` values, every intervening accrual call if the index is used, the index's scale, and the unrounded interest amount. The broad explanation is nevertheless clear: block-count-derived time, boundary timing, and integer division explain a modest shortfall. Solidity's integer division always rounds each increment down.

Arbitrum lands alongside mainnet because its `NUMBER` opcode has special semantics: on Arbitrum One it exposes the first non-Arbitrum parent-chain block number—Ethereum's—not the Arbitrum L2 block number. Arbitrum provides a separate `arbBlockNumber()` for its native L2 number. This behavior is expressly noted in an [Offchain Labs security review hosted in the Arbitrum documentation](https://docs.arbitrum.io/assets/files/2025-12-offchain-arbitrum-chains-genesis-generator-securityreview-ecc17bd8f262c11ea3c8fd6458ff271e.pdf). Therefore the roughly 250 ms sequencing/preconfirmation cadence is irrelevant to this contract's `blocksElapsed` on Arbitrum.

There is one additional accounting qualification: the update is multiplicative. Calling `accrueInterest()` multiple times compounds the index; one call at the end applies simple interest over the whole interval. Therefore the exact result is call-schedule-dependent, even if total counted blocks is the same. Rounding pushes down, while more frequent compounding pushes up.

## What happens on Base

Under Base mainnet's current configuration, its sealed L2 block interval is two seconds. Sub-second Flashblocks are partial preconfirmations, not additional sealed numbered blocks. Base's derivation rules require an L2 block at each configured interval, and OP Stack documentation describes the two-second L2 cadence: [Base derivation specification](https://docs.base.org/base-chain/specs/protocol/consensus/derivation) and [OP Stack glossary](https://docs.optimism.io/op-stack/reference/glossary). As a useful configuration cross-check, Base's current mainnet node file describes a pruning distance of `1,339,200` blocks as approximately 31 days: [Base mainnet node configuration](https://github.com/base/base/blob/main/.env.mainnet).

Over 31 days, approximately

```
Base blocks       = 31 * 86,400 / 2 = 1,339,200
contract seconds  = 1,339,200 * 12 = 16,070,400
                  = 186 encoded days
```

With one accrual covering the whole period, the charge is therefore

```
$1,000,000 * 0.04 * 186 / 365 = $20,383.561644
```

So the comparable whole-dollar result is about **$20,384**, six times the intended simple-interest amount. This is approximately a 24% nominal annual rate, not 4%.

If callers accrue repeatedly, compounding makes it somewhat higher. At the limiting case of very frequent accruals, the 31-day factor approaches

```
exp(0.24 * 31 / 365) - 1 = 2.0593% (approximately)
```

or about **$20,593** on $1,000,000. Actual integer rounding and the actual call schedule determine the precise value. Thus a single exact Base answer cannot be inferred from debt and dates alone; the defensible range under ordinary call schedules is roughly $20,384 up toward $20,593, before scale-dependent rounding effects.

Because this is a deployment planned for next month, the team should re-check Base's active rollup configuration immediately before deployment. [Base's current rollup implementation](https://github.com/base/base/blob/main/crates/common/genesis/src/rollup.rs) already contains support for a post-upgrade canonical 200 ms cadence; if such an upgrade were activated, this defect would become a 60x time multiplier, not 6x. The conclusion does not change: the contract is unsafe to deploy while its economics depend on a hard-coded block interval.

## Recommended change

Do not deploy this implementation unchanged to Base. More generally, do not infer elapsed time from block counts on any chain.

Store `lastAccrualTimestamp` and use `block.timestamp - lastAccrualTimestamp`. This expresses the unit the rate actually uses and avoids chain-specific block-number semantics. Preserve a guard for zero elapsed time, use sufficiently precise fixed-point arithmetic (prefer `mulDiv`-style full-precision multiplication/division), and explicitly decide whether the product promises simple interest or a particular compounding convention.

For example, the minimal conceptual correction is:

```solidity
uint256 elapsed = block.timestamp - lastAccrualTimestamp;
if (elapsed == 0) return;
index += mulDiv(index, rateBps * elapsed, 10_000 * 365 days);
lastAccrualTimestamp = block.timestamp;
```

Production code should avoid overflowing the intermediate `rateBps * elapsed` and should document that this recurrence compounds whenever accrual occurs. If economics must be independent of how often arbitrary users call the function, calculate the index directly from a stored epoch/start value and total timestamp elapsed, or implement a specified continuous/discrete compounding formula, rather than repeatedly adding to the previously accrued index.
