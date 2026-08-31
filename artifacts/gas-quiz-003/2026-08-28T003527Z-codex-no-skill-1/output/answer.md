# Recommendation: deploy the on-chain feed layer on Solana

For an AI-agent social feed, the limiting resource is cheap, frequent writes.
Deploy the *feed registry* on Solana: each post transaction should record an
agent identity, timestamp/sequence number, and a content hash/URI. Keep the
post body, media, embeddings, and search index off-chain (for example in
object storage/IPFS plus an indexer). This provides verifiable authorship and
ordering without turning chain state into an expensive content database.

## Numbers used

As checked 2026-08-27, SOL was **$109.74** and ETH was **$2,512.98** (CoinGecko
spot-price API). Solana's documented base fee is **5,000 lamports per
signature**, or **0.000005 SOL**; a one-signer publish transaction therefore
has this minimum fee. Its optional priority fee is:

```
ceil(CU price [micro-lamports] × CU limit / 1,000,000) lamports
```

At zero priority fee:

```
0.000005 SOL × $109.74/SOL = $0.00054870 per post
1,000,000 posts × $0.00054870 = $548.70 per million posts
```

For a concrete launch model—10,000 agents making 10 posts/day—the volume is
100,000 posts/day (36.5 million/year), so the base transaction budget is:

```
36.5m × $0.00054870 = $20,027.55/year
```

This is a **base-fee estimate**, not a promise: priority fees rise during
contention and SOL/USD moves. Request only the compute units actually needed
and set a per-post priority-fee ceiling.

## Why not make Base the primary feed chain?

Base is a strong runner-up if EVM composability and its agent-payment
ecosystem matter more than write cost. Its official example prices **200,000
gas at the 0.005 gwei minimum L2 base fee** at about **$0.002** when ETH is
$2,000—$2,000 per million transactions *before* the L1 data/security fee.
At the ETH price above, the same execution-only arithmetic is:

```
200,000 × 0.005 gwei = 0.000001 ETH
0.000001 ETH × $2,512.98 = $0.00251298 per transaction
$2,512.98 per million transactions, plus the variable L1 fee
```

Base documents that every transaction includes both L2 execution and L1
security costs, and says the L1 component is typically higher. Thus even this
optimistic execution-only comparison is about **4.58x** Solana's base fee
($0.00251298 / $0.00054870); the all-in gap can be larger.

## Decision and implementation guardrails

Choose **Solana** for the feed's write path: it cuts the modeled annual base
transaction spend by roughly **$71.7k** versus Base's execution-only floor
($91,723.77 - $20,027.55), while its fee model explicitly permits no priority
fee in normal conditions. Design the program so an agent can batch lightweight
actions only where the product semantics allow it, and do not create a new
on-chain account for every post; account storage requires a separate,
recoverable rent deposit.

Use Base only as a later interoperability/payment rail if the product depends
on EVM contracts, USDC/x402 integrations, or Base-native agent users. The
agent ecosystem is genuinely attractive, but it does not offset the recurring
cost difference for a high-volume social-feed ledger.

Sources: [Solana fee documentation](https://solana.com/docs/core/fees),
[Base network-fee documentation](https://docs.base.org/base-chain/network-information/network-fees),
and [Base's agent tools and x402 overview](https://www.base.org/agents).
