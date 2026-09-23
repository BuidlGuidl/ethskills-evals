# Recommendation: Deploy on Base (Ethereum L2)

A social feed for AI agents is a **consumer, high-frequency, low-value-per-tx application** — posts, likes, follows, and micro-tips from autonomous agents. That profile belongs on an L2, and among the L2s, **Base** is the right pick. It's still the Ethereum ecosystem: Base settles to Ethereum L1, uses ETH as its gas token, and inherits L1 security.

---

## Numbers used (live-verified 2026-09-23)

| Input | Value | Source |
|---|---|---|
| Mainnet base fee | **0.36 gwei** (363,559,815 wei) | `cast base-fee`, verified on 3 RPCs (publicnode, dRPC, 1rpc) |
| ETH price | **$2,720** | CoinGecko |
| L2 per-action costs | $0.0005–$0.003 typical | Early-2026 reference table (last verified 2026-03-17; order-of-magnitude stable) |

Mainnet gas is genuinely cheap post-Fusaka — that is *not* the reason to avoid it. The reason is volume: a social feed multiplies per-action cost by action count, and agents don't stop posting when gas spikes.

## Per-action costs, mainnet vs Base

A social feed's writes are small: like/follow ~40k gas, post w/ content hash ~60k gas, ERC-20 tip ~65k gas.

| Action | Mainnet @ 0.36 gwei, ETH $2,720 | Base (early-2026 table) |
|---|---|---|
| Like / follow (~40k gas) | 40,000 × 0.36 gwei = 0.0000144 ETH ≈ **$0.039** | **~$0.001** |
| Post (~60k gas) | 0.0000216 ETH ≈ **$0.059** | **~$0.001–0.002** |
| ERC-20 tip (~65k gas) | 0.0000234 ETH ≈ **$0.064** | **~$0.001** |
| ETH transfer (21k gas) | 0.0000076 ETH ≈ **$0.021** | **~$0.0003** |

Mainnet is **20–60x more expensive per action** at today's cheap base fee — and each action is worth cents or nothing, so the ratio matters more than the absolute price.

## Cost at social-feed scale

Assume the feed reaches **500k agent actions/day** (posts + likes + follows + tips) and grows 10x:

| | Mainnet (~$0.04 avg/action) | Base (~$0.001 avg/action) |
|---|---|---|
| 500k actions/day | **$20,000/day ($600k/mo)** | **$500/day ($15k/mo)** |
| 5M actions/day | $200,000/day | $5,000/day |

The 5M/day figure is game over for mainnet. Note mainnet *could* handle the throughput (post-Fusaka 60M gas/block ≈ 15M+ simple writes/day), but the economics are wrong for social data.

## Spike exposure — the real mainnet risk for autonomous agents

Mainnet base fee spikes to **10–50 gwei** during events, even if only for minutes-to-hours. At those levels a 40k-gas like costs **$1.09–$5.40**. Humans can wait out a spike; autonomous agents posting on a schedule will eat it. L2 fees are far more stable because most of the fee is cheap L2 execution + blob data, not congestible L1 base fee.

## Latency

Base: 250ms–2s blocks; mainnet: ~8s+. Agents in a reply/mention loop need fast confirmation, not 8-second slots.

## Why Base specifically (vs the other L2s)

- **Cheapest of the major L2s** on the reference table: ERC-20 transfer ~$0.001, swap ~$0.002, ERC-20 deploy ~$0.018 (Arbitrum $0.020; zkSync $0.040; Scroll $0.030).
- **AI-agent ecosystem gravity**: Base is where autonomous-agent activity has concentrated — x402 payments, agent wallets, and Coinbase's smart-wallet/paymaster (ERC-4337) infrastructure. A social network's value is network effects; deploy where the agents already are.
- **Fast, stable fees + mature account abstraction** make gasless or sponsored agent onboarding practical (you can run a paymaster so agents don't each need to hold ETH on day one).

Arbitrum is a perfectly good second choice — fees are near-identical ($0.001 transfers, $0.020 deploys). The tiebreaker is the agent-ecosystem momentum on Base, not raw cost.

## Suggested architecture

- **All social activity on Base**: feed contract, follows, likes, tips (runtime costs dominate; this is where the 20–60x matters).
- **Optional mainnet anchor for high-value state**: if you want maximal security for agent identity/ownership or a treasury, register those on mainnet. With base fee at 0.36 gwei, a mainnet contract deploy (~1.2M gas for an ERC-20-class contract) is only **~$1.18** and a complex ~3M-gas suite ~**$2.94** — trivial one-time costs. Value on mainnet, interaction on L2.
- **Deploy cost is a non-issue anywhere**: the full feed contract suite (~2–3M gas) costs **~$3 on mainnet / ~$0.05–0.20 on Base** one-time. Optimize for runtime, not deployment.

## Caveats

- Gas numbers are live-verified (2026-09-23): base fee 0.36 gwei, ETH $2,720. Both fluctuate — re-check with `cast base-fee --rpc-url <rpc>` before committing budgets.
- L2 per-action figures come from an early-2026 reference (verified 2026-03-17); blob-fee drift can move them, but the order of magnitude (sub-cent to ~$0.003) has been stable since Dencun/Fusaka.
- If your feed is *low*-frequency (a few thousand actions/day) and every action is high-value, mainnet's current costs (~$600/day at 15k actions) would be tolerable — but that isn't a social feed.

**Bottom line:** Base. It's the Ethereum ecosystem with 20–60x cheaper actions, sub-cent fees, fast blocks, spike immunity, and the densest AI-agent ecosystem — exactly the profile a high-frequency social feed needs.
