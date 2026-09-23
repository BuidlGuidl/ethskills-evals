# Recommendation: Deploy on Ethereum Mainnet (L1)

## TL;DR

Your escrows hold **$2,000–$50,000 per job** but cost only **~$0.25 in gas per job lifecycle** on mainnet at current fees. The fee is ~0.001–0.013% of the value secured — noise. Moving to an L2 would save you about a quarter per job while adding sequencer, bridge, and fraud-window risk to five-figure escrow balances. For a low-frequency, high-value escrow service, mainnet's security dominates.

## Live numbers used (verified 2026-09-23)

| Input | Value | Source |
|---|---|---|
| Mainnet gas price | **~0.36 gwei** (0.357 via ethereum.publicnode.com, 0.358 via eth.drpc.org) | live RPC |
| Base gas price | ~0.006 gwei (L2 execution only, excludes L1 blob data fee) | live RPC |
| Arbitrum gas price | ~0.020 gwei (L2 execution only, excludes L1 blob data fee) | live RPC |
| ETH price | **$2,732** | CoinGecko |

Post-Fusaka (Dec 2025) the mainnet base fee sits well under 1 gwei — roughly 100x lower than the 2021–2023 era most people still quote. Gas is no longer a reason to avoid L1.

## Escrow gas model

Typical per-job operations (gas units consistent with standard operations: ERC-20 transfer ~65k, approve ~46k, simple calls ~50–100k):

| Operation | Gas |
|---|---|
| One-time contract/factory deploy | ~500,000 |
| USDC approve (client) | ~46,000 |
| Create job + deposit (transferFrom) | ~100,000 |
| Release funds to freelancer | ~50,000 |
| Dispute / refund path (occasional) | ~60,000 |
| **Per-job lifecycle total** | **~200,000–250,000** |

## Mainnet cost per job (250k gas, ETH @ $2,732)

| Gas price scenario | Cost per job | % of a $2,000 job | % of a $50,000 job |
|---|---|---|---|
| 0.36 gwei (today) | **$0.25** | 0.012% | 0.0005% |
| 1 gwei (busy) | $0.68 | 0.034% | 0.0014% |
| 10 gwei (event spike) | $6.83 | 0.34% | 0.014% |
| 50 gwei (extreme, minutes only) | $34.15 | 1.7% | 0.068% |

One-time contract deploy: ~500k gas ≈ **$0.49** at today's fees.

## L2 comparison

The same job lifecycle on Base or Arbitrum (L2 execution + L1 blob data component) costs roughly **$0.005–$0.01**. So going to an L2 saves about **$0.24 per job** — 0.0005–0.012% of the escrowed value. That is the entire upside of the L2, and it buys you:

- Sequencer centralization / downtime risk
- Bridge risk for anything entering or leaving the rollup
- Upgrade-key and fraud-proof-window trust assumptions
- Up to **7-day delay** for optimistic-rollup exits to L1 — hostile to dispute resolution and freelancer payouts

## Why mainnet wins for this product

1. **Value at stake.** $2k–$50k per job, and any real volume means millions in TVL. A quarter per job is a rounding error; a single sequencer/bridge failure on a $10M escrow book is existential. Mainnet has the deepest validator set and the most battle-tested execution layer in the ecosystem.
2. **Low frequency.** Freelance escrows are a handful of transactions over days or weeks — the opposite of the high-frequency consumer traffic L2s are built for. Sub-cent fees and 250ms–2s blocks solve problems you don't have.
3. **Finality and dispute handling.** Mainnet settlement is final within ~13 minutes. Rollup exits and challenge windows take days. For a dispute-heavy product like escrow, that matters more than fees.
4. **Stablecoin liquidity.** You'd likely escrow in USDC or similar, where mainnet liquidity is deepest.

## When to reconsider

- You add **high-frequency, small-value** flows (many sub-$100 jobs per day, consumer UX) → Base or Arbitrum at ~$0.005–$0.01/job makes sense, possibly as an L2 frontend with settlement kept on mainnet (hybrid).
- Volume grows into thousands of jobs/day and per-job gas becomes a real line item — recalculate then; at $2k+ per job it won't be.

## Practical notes

- Escrow the **principal in a stablecoin** (USDC) so neither party bears ETH volatility; users still pay gas in ETH (~$0.10–$0.30 per action today).
- Set `maxFeePerGas` to **1–2 gwei** for headroom (base is usually 0.1–0.5 gwei); spikes above 5 gwei are transient — wait them out rather than paying 10–50x.
- Re-verify gas at deploy time: `cast base-fee --rpc-url <rpc>`. Numbers above were checked 2026-09-23 and drift with time.
