# Gas Plan — Base Payments Relayer

**Live snapshot** (queried 2026-09-23, re-run anytime with `npm run report`):

| Metric | Value |
|---|---|
| Base base fee | 0.005 gwei |
| Effective gas price (incl. priority) | ~0.006 gwei |
| ETH price | ~$2,711 |
| L1 data fee per individual transfer | 3.22 gwei (~0.9% of cost) |

## What we spend today

40,000 ERC-20 transfers/day, one transaction each, measured at **74,579 gas per
payment** (Foundry benchmark, fresh recipient addresses — `npm run gas-test`):

| | Per payment | Per day | Per month | Per year |
|---|---|---|---|---|
| **Today (1 tx per payment)** | $0.001222 | **$48.88** | **$1,466** | **$17,842** |

Cost split: ~99% L2 execution gas, ~1% L1 data (blob) fee. Execution is the
lever that matters on Base right now.

## The plan, ranked by savings

### 1. Audit relayer fee settings — up to ~$12,400/day if misconfigured, $0 if not

**Check this first; it takes five minutes.** Pull any recent relayed tx on
Basescan and look at the effective priority fee (txn fee breakdown).

- Base needs ~**0.001 gwei** priority for next-block inclusion.
- ethers.js and many wallet libs default `maxPriorityFeePerGas` to **1.5 gwei** — 1,500x more.
- If we're paying that default: 74,579 gas × 1.5 gwei ≈ $0.30/payment ≈ **$12,150/day ≈ $4.4M/year**. (Unlikely, but this exact bug is common enough that it must be ruled out before anything else.)
- If we're already paying Base's suggested ~0.001 gwei: this item saves ~$0 and we're done.

**Shipped:** `src/fees.mjs` — drop-in fee overrides for the relayer
(priority capped at 0.002 gwei, maxFee = 4× base fee + tip with a 0.02 gwei
floor, plus `isGasSpike()` for backoff). Use it regardless of the audit outcome
so this can never regress.

### 2. Batch payments through one contract — saves ~$39/day, ~$14,340/year (80%)

Measured, not estimated (`test/GasComparison.t.sol`, cold recipients):

| | Gas/payment | L1 fee/payment | Cost/payment | Per day | Per year |
|---|---|---|---|---|---|
| Individual txs | 74,579 | 3.22 gwei | $0.001222 | $48.88 | $17,842 |
| **Batched, 20/tx** | **14,714** | **0.16 gwei** | **$0.000240** | **$9.59** | **$3,501** |
| **Saving** | **−80%** | **−95%** | **−80%** | **−$39.29** | **−$14,340** |

Why it works: each standalone tx pays 21,000 gas intrinsic + a mostly-fixed L1
data fee. A batch of 20 pays that once. At 40k payments/day (one every ~2.2s),
a 20-payment batch fills in ~45 seconds — settlement latency impact is negligible.

**Shipped:**
- `contracts/BatchPayments.sol` — owner-only `batchTransfer(token, recipients[],
  amounts[])` (contract holds float) and `batchTransferFrom` (pulls from relayer
  allowance, no float). Deploy cost ≈ 600k gas ≈ **$0.01**. Payback: immediate.
- Relayer change: accumulate payments for up to N=20 or ~30s, then send one
  `batchTransfer`. Reuse `src/fees.mjs` for the fee fields.

Operational notes:
- The contract holds token inventory → keep the float small (top up daily),
  owner key = relayer key, and get a review before loading funds. It's ~120
  lines with no external deps.
- One failing payment reverts the batch — validate recipients/amounts
  off-chain before submitting (we already do this for individual sends).

### 3. Defer batches during fee spikes — ~$0–500/year, opportunistic

L1 blob fees are currently near zero (0.9% of our cost), but they spike 10–50x
for minutes-to-hours during L1 congestion events. `isGasSpike()` in
`src/fees.mjs` returns true above 0.5 gwei effective; delay non-urgent batches
when it fires. Cheap insurance, small expected value at current conditions.

## Explicitly not recommended

- **Moving chains.** Base is already among the cheapest realistic options
  (~$0.001/transfer). Mainnet would be ~10x more expensive; other L2s save
  fractions of a cent at most — not worth a migration.
- **Waiting for "gas to drop."** Base fee is already near the floor (0.005
  gwei). There is nothing to wait for.
- **Micro-optimizing calldata / token choice.** Sub-1% effects versus the 80%
  from batching.

## If we do #1 (audit passes) + #2

| | Per day | Per month | Per year |
|---|---|---|---|
| Today | $48.88 | $1,466 | $17,842 |
| After batching | $9.59 | $288 | $3,501 |
| **Savings** | **$39.29** | **$1,179** | **$14,340** |

## Reproduce / verify

```bash
npm run report     # live spend report (Base RPC + GasPriceOracle + ETH price)
npm run fees       # current recommended fee overrides
npm run gas-test   # re-run the Foundry individual-vs-batch benchmark
```

All gas numbers are measured against a mock ERC-20 with fresh recipient
addresses (worst case). If many recipients are repeat customers, real costs are
lower and the baseline shrinks slightly — batching still wins by the same ratio.
