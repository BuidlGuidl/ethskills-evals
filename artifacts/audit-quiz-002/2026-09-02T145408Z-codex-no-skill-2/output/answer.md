# Reconciliation and Base deployment assessment

## Bottom line

Arbitrum One did **not** multiply elapsed time by its roughly 250 ms L2 block cadence. On Arbitrum, the EVM `NUMBER` opcode used by Solidity's `block.number` returns the block number of the first non-Arbitrum parent chain—Ethereum for Arbitrum One. Thus both deployments were effectively counting Ethereum blocks and assigning 12 seconds to each. This is documented Arbitrum-specific behavior; it is not portable EVM behavior ([Offchain Labs security review describing the behavior](https://docs.arbitrum.io/assets/files/2025-12-offchain-arbitrum-chains-genesis-generator-securityreview-ecc17bd8f262c11ea3c8fd6458ff271e.pdf)).

Base is different. Its canonical L2 block time is about 2 seconds ([Base documentation](https://docs.base.org/base-chain/network-information/troubleshooting-transactions)). The contract will count those L2 blocks but assign 12 seconds to each, so it will accrue at approximately **six times the intended rate**. Base's 200 ms Flashblocks are preconfirmations within a canonical block; they do not make `block.number` advance every 200 ms.

## 1. July

The contractual simple-interest benchmark is:

```text
1,000,000 × 0.04 × 31 / 365 = 3,397.260274 USDC
```

For one call spanning the whole period, the code instead computes interest from the number of blocks:

```text
interest = 1,000,000 × 0.04 × (blocksElapsed × 12) / 31,536,000
```

Ethereum has 12-second *slots*, but `block.number` counts produced blocks, not elapsed slots. Missed slots, plus the exact start/end block boundaries selected for the reconciliation, therefore make `blocksElapsed × 12` a little less than wall-clock time. Arbitrum sees substantially the same Ethereum parent block progression, which explains why the two deployments agree.

A 3,391 USDC result corresponds (before token-unit rounding) to approximately:

```text
implied elapsed time = 3,391 / (1,000,000 × 0.04) × 365 days
                     = 30.942875 days

implied block count  = 30.942875 days / 12 seconds
                     ≈ 222,789 blocks
```

Exactly 31 days at one block per 12 seconds would be 223,200 blocks. The difference is about 411 blocks, or 82 minutes of nominal 12-second time. That is the scale needed to explain the roughly 6.26 USDC shortfall through missed slots and/or reconciliation endpoints.

There is one important qualification: the update compounds at every successful call because the new calculation uses the already-increased `index`. Consequently the exact charge also depends on the number and timing of `accrueInterest()` calls. One call over July gives simple accrual; very frequent calls produce approximately continuously compounded accrual. Integer division introduces a small downward truncation at each call, whose size depends on index precision. Therefore **3,391 cannot be proved from the rate and dates alone**. The definitive reconciliation should use the actual first and last `lastAccrualBlock`, every intervening successful accrual transaction, and the index/token precision. The observed number is nevertheless consistent in scale with Ethereum-block counting and is not evidence that Arbitrum counted its own 250 ms blocks.

## 2. What the unchanged code does on Base

At a 2-second canonical block time, 31 days contain approximately:

```text
31 × 86,400 / 2 = 1,339,200 Base blocks
```

The contract converts that to:

```text
1,339,200 × 12 = 16,070,400 seconds = 186 nominal days
```

If `accrueInterest()` is called once after the 31 days, the charge is:

```text
1,000,000 × 0.04 × 186 / 365
= 20,383.561644 USDC
```

That is six times the intended simple-interest charge. It is equivalent to a nominal annual rate of about **24%**, not 4%.

If accrual is called repeatedly, the result is higher because of compounding. In the limiting example of one call every Base block:

```text
1,000,000 × ((1 + 0.04 × 12 / 31,536,000)^1,339,200 - 1)
≈ 20,592.73 USDC
```

Calls at other intervals land between the one-call figure and roughly that per-block figure (apart from integer truncation). Hence there is no single exact Base charge without specifying the call schedule, but approximately **20.4k–20.6k USDC** is the relevant range under normal arithmetic—not 3.4k.

## Recommendation

Do **not** deploy this bytecode unchanged to Base.

Use elapsed timestamp time instead of inferred seconds per block. Store `lastAccrualTimestamp`, calculate `block.timestamp - lastAccrualTimestamp`, and test the intended semantics explicitly. For example, retaining the present discrete/simple update:

```solidity
uint256 elapsed = block.timestamp - lastAccrualTimestamp;
index += Math.mulDiv(index, rateBps * elapsed, 10_000 * 365 days);
lastAccrualTimestamp = block.timestamp;
```

In production, arrange the `mulDiv` operands to avoid overflow, define the fixed-point precision and rounding policy, and decide whether the economic product is simple or compounded interest. The current formula compounds according to an arbitrary operational fact—how often anyone calls a public function—which lets call frequency change borrower charges. A stronger design derives the index directly from elapsed time and a stored checkpoint using a specified linear or exponential rate model, so splitting one interval into many calls cannot change the economic result.

Finally, replay the July event history for both existing deployments before finance signs off. Confirm the actual block deltas and call schedule rather than treating the rounded 3,391 figures as proof that their accounting is identical in every circumstance.
