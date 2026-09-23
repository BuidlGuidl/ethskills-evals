# Recommendation: Ethereum Mainnet

Deploy the escrow on **Ethereum mainnet** (with a stablecoin like USDC as the settlement asset). Gas cost is a rounding error relative to the value you're custodying, and mainnet gives you the strongest security and trust guarantees — which is what actually matters for an escrow holding $2,000–$50,000 per job.

## Live numbers used (checked Sep 23, 2026)

| Input | Value | Source |
|---|---|---|
| Mainnet base fee | **0.377 gwei** | `cast base-fee` via 1rpc.io |
| ETH price | **$2,727** | CoinGecko |
| Priority fee (tip) | ~0.01–0.1 gwei | current market norms |

Post-Fusaka (Dec 2025), the base fee sits well under 1 gwei almost all the time; even pre-Fusaka it had already collapsed to sub-1 gwei thanks to EIP-4844 blobs, activity migrating to L2s, and the doubled gas limit.

## What an escrow job actually costs on mainnet

A typical job lifecycle (USDC): client approves the contract (~46k gas), deposits (~90k gas), funds are released on delivery (~60k gas) — ~196k gas total.

| Operation | Gas | @0.377 gwei | @1 gwei (busy) | @10 gwei (event spike) |
|---|---|---|---|---|
| ERC-20 approve | 46,000 | $0.047 | $0.13 | $1.25 |
| Deposit into escrow | 90,000 | $0.093 | $0.25 | $2.45 |
| Release funds | 60,000 | $0.062 | $0.16 | $1.64 |
| **Full job lifecycle** | 196,000 | **$0.20** | **$0.54** | **$5.35** |
| One-time contract deploy | ~1,500,000 | $1.54 | $4.09 | $40.91 |

**Gas is 0.001%–0.01% of the value held** ($0.20 against a $2,000–$50,000 job). Even a rare 10 gwei spike (which lasts minutes to hours, not days) puts the whole lifecycle at ~$5 — 0.01% of a $50k job or 0.27% of the smallest $2k job.

## Why not an L2 (Base / Arbitrum)?

| | Mainnet | Base/Arbitrum |
|---|---|---|
| Cost per escrow job | ~$0.20 | ~$0.02–0.05 |
| Savings per job | — | ~$0.15–0.19 |

The L2 would save roughly **a quarter per job** against jobs worth thousands of dollars. That's the entire upside. The downsides for this specific use case:

1. **You're custodying client money.** Aggregate TVL across open jobs can easily reach six figures. Mainnet settlement carries no sequencer-centralization risk, no upgrade-key/multisig trust assumptions, and the deepest validator set in the industry. For a $2k–$50k-per-job escrow, that trust profile is a product feature — "your funds are held under Ethereum mainnet consensus" is a selling point to clients, and it lowers your own regulatory/operational risk surface.
2. **Low frequency.** An escrow does ~3 transactions per job over days or weeks. The classic L2 arguments — sub-cent high-frequency UX, 250ms–2s block times — don't apply when the "work" phase of your state machine takes days anyway.
3. **Gas stopped being the differentiator.** The instinct to reach for an L2 comes from 2021–2023, when mainnet txs cost $5–$50. Post-4844/Pectra/Fusaka, the same lifecycle costs $0.20. Saving 80–90% of $0.20 buys you nothing.

## Practical notes

- Set client-side fees with headroom: `maxFeePerGas` 1–2 gwei, `maxPriorityFeePerGas` 0.01–0.1 gwei. Deposits are not latency-sensitive; users can wait out spikes.
- Use USDC (or a similar liquid stablecoin) as the escrow asset so a $2k job is actually $2k — ETH volatility would otherwise change what the escrow is worth between deposit and delivery.
- Add a `cast base-fee` (or `provider.getFeeData()`) check in your deposit flow and warn users if base fee > 5 gwei so they can wait a few minutes.
- **Revisit the L2 question only if** you later add high-frequency, consumer-facing features (milestone micropayments, tips, per-task attestations), or if your job sizes drop below ~$100. A hybrid — value custody on mainnet, activity on an L2 — is the standard pattern then. For this escrow as described, mainnet alone is the right call.

**Bottom line:** at 0.377 gwei, a full escrow lifecycle costs $0.20 — 0.001% of the smallest job you'll hold. Choose the chain for security and trust, not for fees; that's mainnet.