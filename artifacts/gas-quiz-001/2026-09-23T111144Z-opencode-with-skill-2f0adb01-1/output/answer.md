# Escrow for Freelance Payments: Chain Recommendation

**Recommendation: Ethereum mainnet.**

For escrow holding $2,000–$50,000 per job, mainnet's superior security and stablecoin liquidity matter far more than the few cents you'd save on an L2. The numbers below show why.

## Live market data (verified at time of writing)

- Base fee: **0.33 gwei** (`cast gas-price --rpc-url https://ethereum-rpc.publicnode.com` → 330,780,209 wei)
- ETH price: **~$2,735** (CoinGecko)

Post-Fusaka, mainnet fees sit around 0.1–0.5 gwei most of the time, so the quotes from historical memory (30–100 gwei) no longer apply.

## Per-job cost model

A full escrow lifecycle with an ERC-20 (USDC/USDT, the realistic currency for freelance payments):

| Step | Gas used |
|---|---|
| Client approves escrow (ERC-20 approve) | ~46,000 |
| Client deposits (transferFrom) | ~65,000 |
| Release to freelancer (or refund) | ~65,000 |
| **Total per job** | **~176,000 gas** |

Cost per job at various network conditions (ETH $2,735):

| Condition | Effective fee | Cost per 176k gas | % of a $2,000 job | % of a $50,000 job |
|---|---|---|---|---|
| Typical (0.38 gwei incl. tip) | 176,000 × 0.38 gwei = 0.0000669 ETH | **$0.18** | 0.009% | 0.0004% |
| Busy (1 gwei) | 0.000176 ETH | **$0.48** | 0.024% | 0.001% |
| Event spike (10 gwei) | 0.00176 ETH | **$4.81** | 0.24% | 0.01% |

One-time deployment (~600k gas for a modest escrow contract): **~$0.62** at typical conditions.

An escrow handles dispute edge cases (refund, arbiter-mediated release) — adding a few more transfer calls doesn't change the picture; you're still in the sub-$1 range per job even when busy.

## Why not an L2

The same lifecycle on Base/Arbitrum costs roughly **$0.005–$0.015 per job** versus **$0.18 on mainnet**. That ~$0.17 saving is a rounding error against a $2,000–$50,000 principal. Meanwhile, every dollar you escrow on an L2 inherits risks you don't need:

- **Bridge/sequencer risk** — L2s are only as safe as their bridge contracts and sequencer operation; mainnet has no such intermediary. For holding up to $50k of client money, mainnet finality and credence matter.
- **Stablecoin liquidity** — USDC/USDT are native and deepest on mainnet. Funds arriving from client treasuries/CEXs mostly settle on mainnet; forcing them onto an L2 adds friction and bridge overhead that dwarfs the gas saved.
- **Trust optics** — freelance clients putting $50k into escrow will reasonably ask "why is this on a chain I don't recognize?" Mainnet answers that.

## When an L2 would be the right call

If you later add sub-$100 gigs, tipping, milestone micro-payments, or anything high-frequency, an L2 (Base or Arbitrum) makes sense — users there are fee-sensitive and the consumer-grade UX (sub-cent fees, 250ms–2s blocks) helps. That is not this product. For a hybrid model later: keep large-value escrow on mainnet, offer L2 rails for small jobs.

## Practical notes

- Set `maxFeePerGas` ~1–2 gwei, `maxPriorityFeePerGas` ~0.01–0.1 gwei — covers inclusion even in modest spikes.
- Add a spike guard: if base fee > 5 gwei, warn/wait. Spikes last minutes to hours, not days.
- Freelance payments almost certainly mean **USDC as ERC-20**, so model your contract around `approve` + `transferFrom` (numbers above), not raw ETH transfers.
