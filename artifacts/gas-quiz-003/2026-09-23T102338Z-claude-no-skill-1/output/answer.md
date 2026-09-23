# Where to deploy a social feed for AI agents

**Short answer: Base** — but the chain choice is worth ~1 order of magnitude, and the
*architecture* choice (what you put on-chain at all) is worth ~3. Do both: off-chain
signed posts with on-chain identity, payments and periodic Merkle checkpoints, anchored
on Base.

> **Freshness warning.** I had no network access when writing this. Every number below is
> an estimate from training data (cutoff May 2026) with the inputs stated explicitly so
> you can re-run the math against live values. Treat the *ratios* as durable and the
> *absolute dollars* as needing re-verification.

---

## 1. Assumptions

| Input | Value | Note |
|---|---|---|
| ETH price | $3,000 | plug your own |
| L1 base fee | 5 gwei | typical non-congested mainnet |
| L1 blob base fee (normal) | ~1 wei | blob market sits at the floor most of the time |
| L1 blob base fee (stress) | 10 gwei / 100 gwei | episodic spikes when rollup demand clusters |
| L2 gas price (major rollup) | 0.01 gwei | Base/OP/Arbitrum sit in ~0.002–0.05 gwei |
| Active agents | 10,000 | |
| Posts per agent per day | 20 | |
| **Posts/day** | **200,000** | = 2.3 posts/sec average, ~10/sec peak |
| **Posts/month** | **6,000,000** | |
| Gas per post (L2) | 50,000 | one cold SSTORE (~22.1k) + event log + dispatch overhead |
| Gas per post (L1) | 80,000 | same, plus higher intrinsic/calldata cost |
| On-chain bytes per post | ~100 raw → ~40 compressed | content stored off-chain; chain holds a CID + parent ref + author |

Content itself goes to IPFS/Arweave/S3. Nobody should be paying blockspace to store
tweet bodies — a 280-character post is 280 bytes, and at L1 calldata rates that alone
is more than the rest of the transaction.

## 2. Cost per post

Rollup fees have two components: **L2 execution** + **L1 data availability**.
Since EIP-4844, DA is priced in blob gas, and conveniently **1 blob gas ≈ 1 byte**
(a blob is 131,072 blob gas and 131,072 bytes), so DA cost per byte = blob base fee in wei.

**L2 execution:** 50,000 gas × 0.01 gwei = 5 × 10⁻⁷ ETH = **$0.0015**

**DA, normal blob market:** 40 bytes × 1 wei = 40 wei ≈ **$0.00000000012** (free)

**DA, blob base fee 10 gwei:** 40 × 10 × 10⁹ wei = 4 × 10⁻⁷ ETH = **$0.0012**

**DA, blob base fee 100 gwei:** = 4 × 10⁻⁶ ETH = **$0.012**

**L1 mainnet, for comparison:** 80,000 gas × 5 gwei = 4 × 10⁻⁴ ETH = **$1.20**

| Venue | $/post | $/month @ 6M posts |
|---|---|---|
| Ethereum L1 | $1.20 | **$7,200,000** |
| Major L2, calm blobs | $0.0015 | **$9,000** |
| Major L2, 10 gwei blobs | $0.0027 | **$16,200** |
| Major L2, 100 gwei blob spike | $0.0135 | **$81,000** |
| L3 / alt-DA (Celestia, EigenDA) | ~$0.0016 | ~$9,600 |
| Off-chain + on-chain checkpoints | — | **~$40** (see §4) |

Three things fall out of this table:

1. **L1 is a non-starter** — 800× the cost of an L2, and 2.3 posts/sec would consume a
   meaningful fraction of mainnet's entire gas capacity. Not a close call.
2. **All the major L2s are within noise of each other.** They run the same blob DA market
   and similar base fees. Anyone telling you to pick a chain because it's "10× cheaper
   than Base" is comparing against a stale or mispriced baseline. Gas is not the
   differentiator here.
3. **An alt-DA L3 saves you almost nothing** at this scale, because on a mainstream L2 your
   cost is already dominated by *execution*, not DA. The L3 pitch only starts to pay for
   itself at ~100× this volume, and you'd give up Ethereum-backed DA and native
   composability for it. Not worth it yet.

## 3. So why Base specifically?

Since the cost columns tie, decide on everything else. A social feed is a network-effects
product — it dies of empty-room syndrome long before it dies of gas fees.

- **Distribution and an existing social graph.** Farcaster's ecosystem and the bulk of
  consumer onchain-social activity live on Base / the OP Stack. You can read an existing
  identity and follow graph instead of bootstrapping one from zero. This is the single
  largest factor and it isn't close.
- **Agents can't manage gas.** An autonomous agent shouldn't hold ETH, sign interactive
  prompts, or handle nonce contention. You need ERC-4337/7702 account abstraction,
  paymaster sponsorship, session keys and scoped spend permissions as *mature, boring
  infrastructure*. Base's AA and paymaster tooling is the most productionized of the
  Ethereum L2s; you'll sponsor the $9k/month of gas above centrally and your agents never
  touch a token.
- **Throughput headroom.** Base runs the highest sustained gas target of the major
  rollups, with 2s (and falling) blocks. At 10 posts/sec peak you are nowhere near a
  constraint, and headroom means your fees don't spike when a neighbor app goes viral.
- **Ethereum alignment, which you asked for.** OP Stack, Superchain, settles and posts
  data to Ethereum L1. Standard EVM, standard tooling, no bespoke VM, no exotic
  precompiles, credible exit path.

**Runner-up: Arbitrum One** — deepest DeFi liquidity if agents need to *transact* as well
as post, and comparable per-post costs. Pick it over Base only if financial composability
outranks social distribution for you. **Optimism/Unichain/Zora** are fine but give you
less social graph. **ZK L2s** (Scroll, Linea, zkSync) offer faster finality, which your
workload does not care about, at the cost of a thinner consumer-social ecosystem.

## 4. The change that actually matters

Putting every post on-chain is the expensive decision, not the chain you put it on.
Follow the Farcaster model: posts are **off-chain signed messages** replicated across
hubs; the chain holds identity, the key registry, payments, and periodic commitments.

- Hourly Merkle root on Base: 720 txs/month × 60,000 gas × 0.01 gwei = 4.3 × 10⁻⁴ ETH ≈ **$1.30/month**
- Daily L1 anchor for hard finality: 30 × 80,000 gas × 5 gwei = 0.012 ETH ≈ **$36/month**
- **Total ≈ $40/month** vs. **$9,000–81,000/month** fully on-chain — a **~500×** saving.

You keep what the chain is actually good for — censorship-resistant identity, verifiable
authorship, portable social graph, agent-to-agent payments, tamper-evident history via the
roots — and stop paying L1-secured DA for content that is public, replicated and cheap to
serve anyway. You also stop being exposed to blob price spikes, which is the difference
between a $9k and an $81k month in the table above.

## 5. Recommendation

1. **Deploy on Base.** Identity/key registry, agent accounts, payments, checkpoint contract.
2. **Keep posts off-chain**, signed by agent keys, with an hourly Merkle root committed
   to Base and a daily anchor to L1.
3. **Sponsor all gas via a paymaster** so agents never hold ETH; budget ~$50/month at the
   volumes above, or ~$9k/month if you insist on full on-chain posts.
4. **Revisit an L3/alt-DA rollup only above ~100× this volume** (roughly 20M posts/day),
   where the sovereignty and DA savings finally outrun the composability loss.

Before committing, re-check three live numbers — current ETH price, Base's median gas
price, and the trailing-30-day blob base fee distribution — and re-run §2. The ranking
won't move; the dollar figures will.
