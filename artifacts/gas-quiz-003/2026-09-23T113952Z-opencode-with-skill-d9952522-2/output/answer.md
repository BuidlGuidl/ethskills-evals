# Recommendation: Base

Deploy the agent social feed on **Base**. Keep mainnet available for
high-value, low-frequency actions (identity anchoring, settlement) if you ever
need them — but feed activity (posts, likes, follows) is high-frequency,
low-value, and latency-sensitive, which is exactly the workload L2s are for.

## Why not mainnet (even though it's cheap today)

Mainnet gas was measured at **0.36–0.39 gwei** across five samples on
2026-09-23 (RPCs: `ethereum-rpc.publicnode.com`, `eth.drpc.org`) — unusually
low. ETH/USD = **$2,717.21** (Coinlink spot via Coinbase API, same date).
At today's price a 50k-gas post costs ~$0.05. That's *viable for a human's
occasional action*, but wrong for a feed:

- A reaction (30k gas) costs $0.031 — an agent doing 100/day burns $3/day
  just in fees, at the *cheapest* mainnet gas has been in a long time.
- Mainnet base fee is volatile. At 10 gwei (routine congestion), a post is
  **$1.36** and a reaction **$0.82**. You cannot design a high-frequency
  product around the minimum-observed fee.
- Fee per agent/day (20 posts + 100 reactions, 4M gas): **$4.09 today → $109
  at 10 gwei**, vs **$0.066 on Base — and Base's fee doesn't 100x when
  the network is busy.**

## Measured numbers (live, 2026-09-23)

`cast gas-price` on each chain, wei converted to gwei (checked back against
raw readings):

| Chain | gas_price (gwei) | post (50k gas) | reaction (30k gas) | per agent/day | 1,000 agents/day |
|---|---|---|---|---|---|
| Mainnet | 0.376 | $0.0511 | $0.0307 | $4.09 | $4,087 |
| **Base** | **0.006** | **$0.0008** | **$0.0005** | **$0.066** | **$66** |
| Arbitrum One | 0.020 | $0.0027 | $0.0016 | $0.217 | $217 |
| Optimism | 0.001 | $0.0002 | $0.0001 | $0.013 | $13 |
| Linea | 0.075 | $0.0102 | $0.0061 | $0.815 | $815 |

ETH/USD: $2,717.21 (live Coinbase spot). Formulas:
`cost_usd = gas_used × gas_price_gwei × 1e-9 × eth_usd`.

## The OP-stack L1 data fee (measured, not estimated)

On Base/Optimism the L1 data fee is a separate component not included in
`gas-price`. Measured via `GasPriceOracle.getL1Fee()` at
`0x4200...000F` with realistic calldata for a 196-byte `post(string)` tx:

- Base: 0.0000000045 ETH ≈ **$0.000012** per post
- Optimism: 0.0000000067 ETH ≈ **$0.000018** per post

Cross-checked against a real Base receipt
(`0x92af3658...`, 205k gas): L1 fee was **0.1% of total tx cost**. Post-Dencun
blobs have made the L1 component negligible — execution gas dominates, so
that's what to optimize.

## Why Base specifically (and not the cheaper Optimism, or Arbitrum)

1. **Cost is effectively solved on all major L2s.** Optimism measured 5x
   cheaper than Base, but both are sub-cent per action — at $0.0002 vs $0.0008
   per post, fees are no longer the deciding factor for a social product.
2. **Ecosystem gravity.** Base is the de-facto hub for onchain AI-agent and
   social activity (agent launchpads, Farcaster-adjacent apps, Coinbase's
   agent tooling and wallet APIs). A social feed is a network-effects
   business — you want to be where the agents already transact, and where
   the wallet/agent tooling is first-class.
3. **vs Arbitrum One:** Base measured 3.3x cheaper per tx today ($0.0008 vs
   $0.0027 per post), and Arbitrum's fee model also charges L1 calldata
   overhead inside its gas price, which bites harder for chatty workloads.
4. **vs Linea:** ~12x more expensive per post than Base today, smaller
   agent/social ecosystem.

## Caveats

- Gas prices above are point-in-time. Re-measure immediately before
  deployment; Base has been at 0.005–0.01 gwei but is not guaranteed to stay
  there. Set `maxFeePerGas` from a live `cast base-fee` reading at submission
  time — do not hardcode fee fields or port mainnet priority-fee constants.
- If individual posts ever carry real value (e.g., a post that settles a
  payment), reconsider per-action: high-value, low-frequency actions can
  still make sense on mainnet.

## Bottom line

A social feed for AI agents is a high-frequency, low-value workload. Measured
today, Base puts a post at **$0.0008** and a full day of agent activity at
**$0.07** — vs **$4+ on mainnet at its cheapest** — while being the chain
where agent/social activity already lives. Deploy on Base.