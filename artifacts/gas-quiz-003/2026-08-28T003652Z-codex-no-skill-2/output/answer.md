# Recommendation: deploy the on-chain layer on Solana

For an AI-agent social feed, choose **Solana mainnet** for identities, follows, post commitments, payments, and moderation attestations. Its low fixed per-write fee and roughly 400 ms block cadence fit a product where automated agents may create far more writes than human social users. Keep the feed text, media, ranking, and search **off chain**.

This is not a recommendation to put every post body in Solana account data. Put a signed content-address (for example, a CID), author, sequence number, timestamp, and/or Merkle-root commitment on chain; store the actual post in content-addressed storage and run an indexer for feed queries. This gives users verifiable authorship and ordering without turning permanent validator state into the database.

## Numbers used

| Item | Value | Consequence |
|---|---:|---|
| Solana base fee | 5,000 lamports per signature | A normal one-signer post costs 0.000005 SOL before any priority fee. |
| SOL conversion | 1 SOL = 1,000,000,000 lamports | 5,000 lamports = 0.000005 SOL. |
| SOL/USD price used | $109.61/SOL | A reproducible price snapshot, queried 2026-08-27; do not treat it as a quote. |
| Base-fee cost/post | 0.000005 x $109.61 = **$0.000548** | About 0.055 cents per committed post. |
| 1 million posts | 5 SOL = **$548.05** | The useful scale comparison. |
| 100,000 posts/day | 0.5 SOL/day = **$54.81/day** | About **$1,644/month** at 30 days, excluding priority fees. |
| Block cadence | about 400 ms | Fast enough for a live-agent interaction loop. |
| Max compute/transaction | 1,400,000 CUs | Ample ceiling for a compact `create_post` instruction; profile the actual program. |

The fee math is deliberately simple:

```
cost_usd = signatures * 5,000 / 1,000,000,000 * SOL_USD
         = 1 * 5,000 / 1,000,000,000 * 109.61
         = $0.00054805 per post
```

Priority fees are variable and must be budgeted. Solana's documented formula is `ceil(CU_price_micro_lamports * CU_limit / 1,000,000)` lamports. For example, requesting 200,000 CUs at 1,000 micro-lamports/CU adds 200 lamports, so the total is 5,200 lamports = **$0.000570/post** at the price above. At 100,000 posts/day that is **$57.00/day**. Set a tight CU limit after simulation; the priority charge uses the requested limit, not the CU actually consumed.

## Why this fits the product

Agents can post, reply, react, and pay each other at a cadence where even a few cents per action becomes a product constraint. Solana has one global state, sub-cent fees, and ~400 ms blocks. The base fee is explicit and predictable for a one-signature agent transaction; at the workload above, fee sponsorship is economically practical. This also permits a small anti-spam fee or stake without excluding ordinary agents.

Avoid a single mutable “global feed” account: all writes to one account contend on the same writable state. Partition records by time shard or author, emit a compact post event/commitment, and have the indexer assemble timelines. Do not create a rent-funded account for every post. As a concrete indication of why, the mainnet RPC returned **1,559,040 lamports (0.00155904 SOL)** as the rent-exempt minimum for a 96-byte account on the same date—roughly **$0.171** locked per account at the price above, over 300 times the one-signature fee. Rent can be recovered when an account is closed, but it is still the wrong shape of storage for an unbounded social archive.

## Trade-offs and the alternative

Solana means building with Rust/Anchor and account/locking-aware data models; it is less convenient than Solidity if the rest of the product is deeply EVM native. It also requires a production RPC/indexing plan, because a social feed needs reliable historical search regardless of chain.

If Ethereum/EVM composability, existing Solidity contracts, or Ethereum-backed settlement is more important than a very large write rate, use **Base** as the runner-up. Base's documented minimum L2 base fee is 0.005 gwei; at $2,000/ETH that makes a 200,000-gas *execution* component about $0.002. But Base also charges an L1 data/security component, which is typically the larger part and varies with Ethereum conditions. That is a sensible EVM social protocol choice, but not my first choice for a feed expected to be dominated by machine-generated writes.

## Sources and assumptions

* Solana, [Fees](https://solana.com/docs/core/fees) and [Fee Structure](https://solana.com/docs/core/fees/fee-structure): 5,000 lamports/signature, priority-fee formula, and 1.4M-CU maximum.
* Solana, [Core concepts](https://solana.com/docs/core) and [Markets & Trading](https://solana.com/docs/defi): lamport conversion and ~400 ms blocks.
* The $109.61 SOL price and the 96-byte rent result are point-in-time RPC/API inputs from 2026-08-27. Dollar totals scale linearly with SOL price; replace `109.61` with the current price in the formula before committing a budget.
* Base comparison: [Base Network Fees](https://docs.base.org/base-chain/network-information/network-fees).
