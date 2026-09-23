# Recommendation: Base (Ethereum L2), not mainnet

For a social feed for AI agents, deploy on **Base** (with Arbitrum as a close second).
Reserve Ethereum mainnet only for high-value settlement or identity anchors.

## Why an L2 at all

A social feed is a high-frequency, low-value-per-action workload. The dominant
cost driver is per-transaction fees multiplied by volume:

- AI agents post, react, repost, and tip far more often than humans do.
- Agents are programmatic — they will generate thousands of transactions per day
  once traction starts.
- Agent UX benefits from fast finality (250ms–2s L2 blocks vs ~8s mainnet).

## The numbers (verified 2026-09-23)

- **Mainnet base fee (live):** ~0.34 gwei (`cast base-fee --rpc-url https://ethereum-rpc.publicnode.com`) — post-Fusaka mainnet is genuinely cheap now.
- **ETH price:** ~$2,000–2,300 (order-of-magnitude basis for cost estimates).

Cost per typical social-feed action (ERC-20-transfer-sized, ~65,000 gas, or a
lightweight post/attestation write):

| Chain | Cost per action | Cost at 10,000 actions/day | Cost at 1M actions/month |
|---|---|---|---|
| Ethereum mainnet (0.1–0.5 gwei) | ~$0.013–0.065 | ~$130–650/day | ~$400–2,000/month |
| Base | ~$0.001 | ~$10/day | ~$300/month |
| Arbitrum | ~$0.001 | ~$10/day | ~$300/month |
| zkSync / Scroll | ~$0.001–0.002 | ~$10–20/day | ~$300–600/month |

So mainnet is no longer the "$50 per post" horror story of 2021–2023 — but it is
still **~10–60x more expensive per action** than an L2. For a feed where agents
might do millions of low-value writes, that multiplier is the whole business model.

## Why Base specifically

1. **Cost:** ~$0.001 per action — sub-cent at any realistic scale.
2. **Ecosystem fit:** Base has the strongest consumer/social and AI-agent
   ecosystem in the L2 landscape today (agent tooling, social protocols,
   onchain identity experiments cluster there).
3. **Ethereum-committed:** Base is an Ethereum L2 (Optimism OP Stack), settles
   to Ethereum, uses ETH for gas — fully inside the ecosystem you're committed to.
4. **Speed:** ~2s blocks, fast confirmations — good for a live feed.
5. **L1 data costs post-EIP-4844 are tiny:** L2 batches post as blobs; the L1
   data component of a Base tx is roughly $0.0027 for a swap-sized tx, and
   Pectra (May 2025) + Fusaka (Dec 2025) expanded blob capacity further.

## Suggested architecture (hybrid)

- **L2 (Base):** posts, reactions, follows, agent-to-agent tips/payments — the
  high-frequency graph.
- **Mainnet:** agent identity/registry anchoring, high-value settlement,
  anything that needs maximum security or composes with mainnet liquidity.
  At current gas (~0.3 gwei), a mainnet contract deploy is well under $1 and an
  occasional anchor transaction costs pennies — cheap enough to use selectively.

## Numbers used

| Input | Value | Source |
|---|---|---|
| Mainnet base fee | ~0.34 gwei | live `cast base-fee`, 2026-09-23 |
| Typical quiet-period base fee | 0.1–0.5 gwei | post-Fusaka norm |
| ETH price | ~$2,000–2,300 | recent range |
| ERC-20-class action gas | ~65,000 gas | standard |
| Base per-action cost | ~$0.001 | L2 fee trackers (Basescan) |
| Mainnet per-action cost | $0.013 @ 0.1 gwei, $0.065 @ 0.5 gwei | gas × fee × ETH price |

**Bottom line:** Deploy the feed on Base, keep identity and high-value state
on Ethereum mainnet. Don't pay mainnet prices for million-action-per-month
agent chatter, but don't leave the Ethereum security umbrella either — an L2
gives you both.
