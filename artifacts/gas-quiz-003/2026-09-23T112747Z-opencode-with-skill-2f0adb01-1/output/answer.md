# Recommendation: Deploy on Base (Ethereum L2)

A social feed for AI agents is a high-frequency, consumer-style workload —
automated agents posting, replying, liking, and tipping around the clock. That
profile belongs on an L2, and **Base** is the best fit within the Ethereum
ecosystem. Keep the option of anchoring identity/settlement on mainnet.

---

## The numbers (measured today, 2026-09-23)

| Input | Value | Source |
|---|---|---|
| Mainnet base fee | **~0.32 gwei** (316,546,423 wei) | `cast base-fee` via publicnode RPC |
| ETH price | **~$2,500** | CoinGecko ($2,501.69) |
| Feed action (post/reply/like) | ~100,000 gas | typical contract call + content hash |
| Complex contract deploy | ~3,000,000 gas | order-of-magnitude guide |

Note: the common assumption that mainnet gas is "10–30 gwei" is wrong.
Post-Fusaka (Dec 2025), the base fee is under 1 gwei most of the time — I
verified 0.32 gwei live. Mainnet is genuinely cheap now. But cheap-at-rest is
not the right metric for this app; see below.

## Cost per feed action

Gas cost = `gas × gwei × 1e-9 × ETH_price`. At ETH = $2,500:

| Scenario | Cost per ~100k-gas action |
|---|---|
| Mainnet @ 0.32 gwei (today) | 100,000 × 0.32e-9 ETH = 0.000032 ETH ≈ **$0.08** |
| Mainnet @ 1 gwei (busy) | 0.0001 ETH ≈ **$0.25** |
| Mainnet @ 10 gwei (event spike) | 0.001 ETH ≈ **$2.50** |
| **Base (L2)** | **~$0.001–0.002** |

L2s carry two cost components — L2 execution (~$0.0003) plus L1 blob data
(~$0.002 or less post-EIP-4844) — which is why a Base transaction lands around
a tenth of a cent to two tenths of a cent, roughly **40–100x cheaper than
mainnet even at today's ultra-low fees**.

## At the scale of an agent feed

Agents don't post once a day; they post continuously. At **1M actions/day**:

| Chain | Daily cost | Monthly cost |
|---|---|---|
| Mainnet @ 0.32 gwei (best case) | ~$80,000 | ~$2.4M |
| Mainnet @ 1 gwei | ~$250,000 | ~$7.5M |
| **Base** | **~$1,500–2,000** | **~$50–60k** |

And the mainnet figures are the *optimistic* case. Base fee spikes to 10–50
gwei still happen during major events and last minutes to hours — for an
automated system firing thousands of posts per minute, that's a 30–150x cost
blowout you can't schedule around. L2 fees stay sub-cent and predictable.

## Why Base specifically (vs. other Ethereum L2s)

Comparative costs per action (early-2026 figures):

| Action | Arbitrum | Base | zkSync | Scroll |
|---|---|---|---|---|
| ETH transfer | $0.0003 | $0.0003 | $0.0005 | $0.0004 |
| Swap | $0.003 | $0.002 | $0.005 | $0.004 |
| NFT mint | $0.002 | $0.002 | $0.004 | $0.003 |

Fees are close, so the tiebreakers are ecosystem fit:

1. **Agent/consumer ecosystem**: Base is where AI-agent and social activity is
   concentrating (Coinbase's agent tooling and x402 agent payments, Farcaster
   social graph, agent wallets). Your users — agents and their operators — are
   already there.
2. **Latency**: 250ms–2s block times vs ~12s mainnet slots. Agents posting and
   reacting in near-real-time need fast soft confirmation.
3. **Ethereum-aligned**: OP-stack rollup settling to mainnet — you stay in the
   Ethereum ecosystem with L1 security, as required.

Arbitrum is a fine runner-up (similar costs, deeper DeFi), but it skews DeFi
rather than social/agent.

## What NOT to do

- **Don't pick a non-Ethereum chain** because "Ethereum is expensive" — that
  premise is outdated. Mainnet base fee is 0.32 gwei; an L2 like Base is
  sub-cent. The ecosystem constraint costs you almost nothing.
- **Don't put the whole feed on mainnet** even though mainnet is now cheap:
  at agent posting frequency, the 40–100x gap compounds into millions of
  dollars per year, and spike exposure is unbounded.

## Suggested architecture (hybrid)

- **Base**: posts, replies, likes, tips, feed state — everything high-frequency.
- **Mainnet (optional)**: agent identity/reputation registry or a periodic
  merkle anchor of the feed. At 0.32 gwei, a ~3M-gas registry deploy costs
  0.00096 ETH ≈ **$2.40** — one-time cost is trivial.
- Set agent fee policies defensively regardless of chain
  (`maxFeePerGas: 1–2 gwei` headroom, priority fee 0.01–0.1 gwei on mainnet)
  and retry on spikes rather than paying through them.

## Caveats

Gas and ETH price drift. Before finalizing, re-check with:

```bash
cast base-fee --rpc-url https://ethereum-rpc.publicnode.com
```

and a live ETH price source. The durable facts: mainnet is now cheap for
low-frequency, high-value logic; L2s are 5–100x cheaper still and are the
right home for high-frequency social activity. **Deploy the feed on Base.**