# Which chain for a social feed for AI agents?

**Recommendation: Base (an Ethereum L2). Keep identity and any high-value state anchored to Ethereum mainnet.**

## Why an L2, and why Base specifically

A social feed is the textbook L2 use case:

- **High-frequency, low-value transactions.** Posts, likes, reposts, follows — each is worth fractions of a cent. On any chain where a single action costs more than a fraction of a cent, the economics of the product break.
- **Latency matters.** Agents (and the humans watching them) expect near-instant feedback. Base has ~2s blocks vs ~8s+ effective confirmation on mainnet.
- **You're still in the Ethereum ecosystem.** Base is an Optimism-stack optimistic rollup that settles to Ethereum and uses ETH for gas. You inherit Ethereum security for final settlement; you're not defecting to an alt-L1.
- **Ecosystem fit.** Base has become the default home for consumer/social and AI-agent experiments in the EVM world (Farcaster adjacency, agent tokens, etc.), so the users, wallets, indexing infra, and composable protocols you'd want are already there.

## The numbers

Live check today (2026-09-23) via `cast base-fee --rpc-url https://ethereum-rpc.publicnode.com`:

- **Mainnet base fee: ~0.34 gwei** (well within the post-Fusaka norm of 0.1–0.5 gwei)
- **ETH price: ~$2,000** (order-of-magnitude assumption for cost math)

### Cost per action (a "post" ≈ a modest contract write, ~65,000 gas, ERC-20-transfer-equivalent)

| Chain | Gas math | Cost per post |
|-------|----------|---------------|
| Mainnet | 65,000 gas × 0.34 gwei × $2,000/ETH | **~$0.044** |
| Base | L2 execution (~$0.0003) + L1 blob data share | **~$0.001** |

That's a **~40x difference** per action.

### What that means at product scale (100,000 posts/day)

| Chain | Daily cost | Monthly cost |
|-------|-----------|--------------|
| Mainnet | 100k × $0.044 = **$4,400/day** | **~$132,000/mo** |
| Base | 100k × $0.001 = **$100/day** | **~$3,000/mo** |

And that's optimistic for mainnet: a real social post with content pointers, indexing events, and social-graph writes will cost more gas than a bare ERC-20 transfer, and mainnet spikes to 5–50 gwei during events would multiply those figures 10–100x for hours at a time. L2 fees stay sub-cent regardless, because the L1 data component rides on cheap blobs (EIP-4844, expanded by Pectra and Fusaka).

### Deployment cost (one-time, minor either way)

- ERC-20-scale contract deploy: mainnet ~$0.50–2.40, Base ~$0.02. Not a deciding factor.

## Why not mainnet?

Mainnet gas is genuinely cheap now (a swap is ~$0.04, not the $20+ of 2021–2023), and for DeFi, governance, or high-value transfers I'd say deploy there without hesitation. But for a social feed you're asking users/agents to transact constantly, and 40x per action plus 4x worse latency plus exposure to fee spikes is a real product tax with no compensating benefit — a feed post is not a high-value settlement that needs L1 finality.

## Why not a cheaper-but-farther option?

Alt-L1s or exotic DA setups might shave the $0.001 further, but you said you're committed to the Ethereum ecosystem — and at sub-cent fees, cost stops being the binding constraint anyway. Liquidity, tooling, wallets, and trust are. Base wins on those.

## Suggested architecture (hybrid)

- **Base:** all feed actions — posts, likes, follows, agent registrations, micro-payments/tips between agents.
- **Ethereum mainnet:** the canonical agent identity/registry and any treasury or high-value state, bridged or attested from L2. Mainnet is cheap enough (~$0.01–0.05 per write) that anchoring identity there costs you almost nothing and buys maximal credibility and composability with mainnet DeFi.

## Caveats

- Gas and ETH prices drift. Verify before committing: `cast base-fee --rpc-url <mainnet RPC>` and check Basescan for current L2 fees. The ~40x L1/L2 cost ratio has been stable and is unlikely to flip.
- Base is a single-sequencer rollup today; if maximum censorship resistance for the feed itself is a core requirement, weigh that, or consider Arbitrum (comparable fees, ~$0.001/transfer, more decentralized sequencing roadmap).
