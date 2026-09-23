# Recommendation: Ethereum mainnet

## The measured numbers (2026-09-23)

| Reading | Source | Value |
|---|---|---|
| ETH/USD | Coinbase spot API | $2,732.20 |
| Mainnet gas price | `cast gas-price` (publicnode) | 316,450,539 wei = **0.316 gwei** |
| Mainnet gas price | `cast gas-price` (drpc, second source) | 285,614,441 wei = 0.286 gwei |
| Base L2 gas price | `cast gas-price` (mainnet.base.org) | 6,000,000 wei = 0.006 gwei |
| Base L1 data fee, 100-byte escrow call | `GasPriceOracle.getL1Fee` at `0x4200...000F` | 2,731,658,167 wei ≈ $0.0000075 (negligible, post-Dencun blobs) |

## Gas-used assumptions

- **Per escrow operation** (create job + deposit, or release payout: job-struct SSTOREs + ETH transfer + events): **75,000 gas**. Both chains run the same EVM, so this applies to mainnet and to the execution half of any L2.
- **One-time deployment** (escrow contract + factory): **700,000 gas**.
- Formula: `cost_usd = gas_used × gas_price_gwei × 1e-9 × eth_usd` (plus `l1_fee_eth × eth_usd` on an L2).

## What each chain costs today

| Operation | Mainnet @ 0.316 gwei | Base @ 0.006 gwei + L1 fee |
|---|---|---|
| Escrow create or release (75k gas) | **$0.065** | **$0.0012** |
| Contract deployment (700k gas, one-time) | $0.61 | ~$0.01 |

Both are effectively free right now. Fees are not the deciding factor at current prices.

## Stress test: the spike case

Mainnet gas is volatile. At a historical demand-spike price of **50 gwei**, an escrow
operation costs:

```
75,000 × 50 gwei × 1e-9 × $2,732 = $10.25 per operation
```

- Against the smallest job ($2,000): **0.51%**
- Against the largest job ($50,000): **0.02%**

Even in a bad gas market, fees are under 1% of the value being moved for every job size
you described. Your users are paying thousands of dollars per job; a worst-case
$5–10 transaction fee does not change their behavior. A job this size would tolerate
even 200 gwei (≈$41/op, 2% of the smallest job) before fees became a real objection.

## Why mainnet and not an L2

1. **Your usage profile is the textbook mainnet case**: low-frequency
   (a few ops per job), high-value ($2,000–$50,000), and latency-tolerant
   (freelance jobs run days-to-weeks; nobody needs 2-second confirmations).
   Measured today, mainnet costs cents per operation — the instinct that
   "mainnet gas is expensive" is stale at 0.3 gwei.

2. **The contract holds other people's money for extended periods.**
   An L2 adds trust assumptions on top of the L1 you already trust: a sequencer
   that can reorder/withhold, upgradeable system contracts with admin keys, and
   delayed L1 finality. For a contract sitting on up to $50k of client funds at
   a time — and an aggregate TVL that grows with your user base — removing those
   extra layers is worth far more than the $0.06 you save per operation.

3. **USD-denominated jobs want the settlement layer.**
   If jobs are quoted in dollars, you will hold USDC. Mainnet has the canonical
   contract, the deepest liquidity, and the most battle-tested integrations.

4. **Disputes and resolution are rare but high-stakes** — another
   low-frequency, high-value pattern. You want them on the chain with the
   strongest liveness and censorship resistance.

## Caveat

If the product later adds high-frequency micro-actions (many milestones per
job, streaming payments, per-attestation writes), deploy the same contract on
Base as well — measured at ~$0.0012/op with a negligible L1 data fee, it stays
cheap even when mainnet spikes. But for escrow jobs holding $2k–$50k,
**deploy on Ethereum mainnet**.