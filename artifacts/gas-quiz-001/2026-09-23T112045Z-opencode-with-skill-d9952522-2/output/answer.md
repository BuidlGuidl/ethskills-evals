# Recommendation: Deploy on Ethereum mainnet

## TL;DR

Escrow is a **low-frequency, high-value** workload: a handful of transactions per
job, with $2,000–$50,000 sitting in the contract for days or weeks. Measured
today, a full job lifecycle costs **~$0.26 on mainnet vs ~$0.03 on Base** — a
difference of ~$0.23 per job. That is noise next to a $2,000 job, and it buys you
the strongest security and liveness guarantees for holding other people's money.
The "mainnet is too expensive" instinct is stale: mainnet gas is **0.315 gwei**
right now.

## Measured data (2026-09-23)

| Reading | Source | Raw | Converted |
|---|---|---|---|
| Mainnet gas price | `cast gas-price` via publicnode | 314,636,188 wei | 0.315 gwei |
| Mainnet gas price (cross-check) | `cast gas-price` via drpc | 315,490,438 wei | 0.315 gwei |
| Mainnet base fee | `cast base-fee` via drpc | 314,636,188 wei | 0.315 gwei |
| Base gas price | `cast gas-price` via mainnet.base.org | 6,000,000 wei | 0.006 gwei |
| Base L1 data fee, 100-byte tx | `GasPriceOracle.getL1Fee` (0x4200…000F) | 3,080,237,979 wei | 0.0000000031 ETH |
| Arbitrum gas price | `cast gas-price` via arb1.arbitrum.io | 20,192,000 wei | 0.020 gwei |
| ETH/USD | Coinbase spot | — | $2,728.37 |

## Cost model

Formula: `cost_usd = gas_used × gas_price_gwei × 1e-9 × eth_usd`
(OP-stack L2s add the L1 data fee on top; measured, not estimated.)

Gas-used assumptions (no contract exists yet, so these are stated estimates):

| Operation | Gas | Basis |
|---|---|---|
| Contract deployment (one-time) | 2,000,000 | mid-size contract, ~8 functions |
| Deposit / create escrow | ~100,000 | ERC-20 `transferFrom` + 3–5 SSTOREs (~20k each) |
| Approve / release | ~50,000 | 1–2 storage writes + transfer |
| Withdraw / payout | ~50,000 | 21k transfer + storage cleanup |
| Dispute path (occasional) | ~80,000 | arbiter call + state updates |
| **Representative job lifecycle** | **~300,000** | 3–5 txs per job |

### Per-job costs (ETH @ $2,728.37)

**Mainnet** (0.315 gwei):
- Deposit (100k gas): 100,000 × 0.315 gwei × 1e-9 × $2,728.37 = **$0.086**
- Full lifecycle (300k gas): 300,000 × 0.315 gwei × 1e-9 × $2,728.37 = **$0.26**
- Deployment (one-time): 2,000,000 × 0.315 gwei × 1e-9 × $2,728.37 = **$1.72**

**Base** (0.006 gwei + L1 fee, 100-byte calldata):
- Execution (100k gas): 100,000 × 0.006 gwei × 1e-9 × $2,728.37 = $0.0016
- L1 data fee (measured): 0.0000000031 ETH × $2,728.37 = $0.0084
- Per tx ≈ **$0.010** → lifecycle ≈ **$0.03**

**Arbitrum** (0.020 gwei, execution only — L1 data component not measured):
- Per tx (100k gas) ≥ 100,000 × 0.020 gwei × 1e-9 × $2,728.37 = **$0.0055**

### The difference, in context

| Chain | Lifecycle cost | % of a $2,000 job | % of a $50,000 job |
|---|---|---|---|
| Mainnet | $0.26 | 0.013% | 0.0005% |
| Base | ~$0.03 | 0.0015% | 0.00006% |

Base saves **~$0.23 per job**. For a service escrowing up to $50k per job, that
is not a meaningful saving — and on Base the L1 data fee is ~84% of each
transaction's cost anyway, so the L2's cheap gas is not even the dominant term.

## Sensitivity to gas spikes

Gas is volatile; the 0.315 gwei reading will not hold forever:

| Mainnet gas | Lifecycle cost | % of $2,000 job |
|---|---|---|
| 0.315 gwei (today) | $0.26 | 0.013% |
| 3 gwei (10× today) | $2.48 | 0.12% |
| 30 gwei (100× today, real congestion) | $24.56 | 1.23% |

Even at 100× today's gas, the full lifecycle costs ~1.2% of the *smallest* job.
Mainnet would have to fall below ~0.04 gwei to match Base's price — the L2
wins on price by ~8×, but in absolute terms both are rounding errors for this
workload.

## Why mainnet

1. **Workload profile fits.** A few transactions per job, jobs lasting days to
   weeks — this is the canonical low-frequency, high-value pattern. Cost never
   becomes a reason to leave L1 here.
2. **Funds at rest.** Client money sits in the contract for the job's duration.
   Mainnet's economic security, validator set, and battle-tested stack are the
   strongest available place to park escrowed funds; a chain-level liveness or
   security event on a younger L2 puts the entire escrow corpus at risk.
3. **The cost intuition is stale anyway.** The usual reason to avoid mainnet —
   expensive gas — measures 0.315 gwei today, cross-verified on two RPCs. Even
   a 100x spike keeps per-job cost ~1% of the smallest job.
4. **Ecosystem depth.** Canonical USDC, Chainlink, audited dispute/oracle tooling,
   and the largest liquidity for any payout asset.

## When to reconsider

Switch (or add) an L2 like Base if the product grows **high-frequency, low-value
actions** — per-message updates, streaming per-minute payouts, milestone chains
of dozens of txs. At today's measured prices Base runs ~$0.01/tx; that is where
an L2's cheap execution actually matters. Also note the OP-stack L1 data fee
dominates Base txs today (~84% of cost), so calldata compression would be the
first optimization there, not gas golfing.

Re-measure gas and ETH/USD at deployment time — the numbers above are a
snapshot from 2026-09-23 — and derive EIP-1559 fee fields from the target chain
at submission rather than hardcoding them.