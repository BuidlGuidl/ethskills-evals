# Where to deploy a social feed for AI agents

**Recommendation: Base (OP Stack L2, Ethereum DA) — but only put identity, payments and
content *commitments* onchain. Do not write one transaction per post.**

Runner-up: Arbitrum One. Disqualified: Ethereum L1 for the feed itself.

The chain choice matters less than the data-placement choice; the numbers below show why.

---

## 1. Assumptions (state them, then re-verify before you commit)

These are the inputs to every number in this doc. All prices are order-of-magnitude
estimates for late 2026 and move constantly — re-check on a live gas tracker before
you size a budget.

| Input | Value used | Note |
|---|---|---|
| ETH price | $4,000 | |
| Agent posts | 1,000,000 / day | 10k agents × 100 posts/day; your scaling target |
| Post payload | 200 bytes | ~short text + refs; ~120 bytes after compression |
| L1 base fee | 5 gwei | typical quiet period; 30+ gwei during spikes |
| L1 blob base fee | 10 gwei | blobs sit at 1 wei much of the time, spike to 100s |
| Base L2 gas price | 0.01 gwei | Base L2 base fee is routinely 0.003–0.05 gwei |
| Arbitrum L2 gas price | 0.01 gwei | floor is 0.01 gwei |

Gas for one "post an event" transaction on an L2:

```
21,000  base tx cost
 1,975  LOG1 (375 + 375 topic + 8/byte × 200 bytes)
~2,000  calldata + memory + SSTORE-free bookkeeping
------
~25,000 gas
```

---

## 2. Cost per post, per venue

### Ethereum L1 (mainnet)
```
25,000 gas × 5 gwei      = 0.000125 ETH  = $0.50 / post
1M posts/day                             = $500,000 / day
```
At 30 gwei it is $3.00/post, $3M/day. L1 block gas limit also caps you at roughly
45M gas / 12s ÷ 25k ≈ **150 posts/sec of the entire chain**, which you will not get.
**L1 is off the table for feed writes.** Ratio vs. Base: ~100–500×.

### Base (or any Ethereum-DA rollup) — one tx per post
Two cost components:

**L2 execution:**
```
25,000 gas × 0.01 gwei = 2.5e-7 ETH = $0.0010 / post
```

**L1 data availability (blobs, EIP-4844):** one blob is 131,072 bytes and is priced
as a whole:
```
131,072 × 10 gwei = 0.00131 ETH = $5.24 per blob
120 compressed bytes / 131,072 × $5.24 = $0.0048 / post
```
(When blob base fee is at its 1 wei floor this term rounds to zero. When blobs are
congested at 200 gwei it is ~$0.10/post — this is your main cost-variance risk, and
it is *shared with every other rollup using Ethereum DA*.)

**Total: ~$0.006 / post → ~$6,000 / day at 1M posts/day.**

Throughput headroom: Base runs at roughly 25–35 Mgas/s in 2026, so 25k gas/post
implies ~1,000 posts/sec ≈ **86M posts/day** ceiling — you'd be using ~1% of the
chain. Not a capacity problem; a bill problem.

### Base with batched commitments — the actual design
Hash 10,000 posts into a Merkle root, publish one root per batch (~50,000 gas),
serve the post bodies from a Farcaster hub / your own indexer / IPFS, and let anyone
verify inclusion against the root.

```
50,000 gas × 0.01 gwei                   = $0.0020 per batch
+ ~32 bytes DA                           ≈ $0.0000 (rounding)
÷ 10,000 posts                           = $0.0000002 / post
1M posts/day = 100 batches               = $0.20 / day
```

**~30,000× cheaper than one-tx-per-post, and ~2,500,000× cheaper than L1.**
You keep censorship-evident, timestamped, verifiable history. You give up
"every like is an L2 transaction," which no one was paying $6k/day for anyway.

### Your own L3 / appchain with alt-DA (Celestia, EigenDA)
~$0.00001/post at one tx per post. Only worth it above roughly **5M posts/day of
genuinely onchain writes**, and it costs you Ethereum-grade DA guarantees, bridge
liquidity, and every wallet/indexer integration you'd get free on Base. Revisit
later; not a launch decision.

---

## 3. Summary table

| Venue | $/post | $/day @ 1M | Verdict |
|---|---|---|---|
| Ethereum L1 | $0.50 – $3.00 | $500k – $3M | No |
| Base / Arbitrum, 1 tx per post | ~$0.006 | ~$6,000 | Workable, wasteful |
| **Base, batched Merkle commitments** | **~$0.0000002** | **~$0.20** | **Recommended** |
| Own L3 + alt-DA | ~$0.00001 | ~$10 | Premature |

---

## 4. Why Base specifically, among the cheap Ethereum L2s

Cost is a near-tie across Base, Arbitrum One, OP Mainnet, Scroll, Linea and zkSync Era
— they all pay the same Ethereum blob price and all have sub-cent L2 execution. So
decide on everything *except* cost:

1. **The social graph already lives there.** Farcaster's registry and its onchain
   identity/storage contracts are on OP Stack chains in the Base/Optimism orbit, and
   Farcaster is where AI agents are already posting. You can reuse an existing agent
   identity + follower graph instead of bootstrapping one, which is the hard part of a
   social product — not the gas.
2. **Agent payments infrastructure.** Base is the home of x402-style
   HTTP-native agent payments and has mature ERC-4337 / EIP-7702 support with
   sponsoring paymasters. Agents need programmatic wallets with session keys and
   spending caps; that tooling is deepest here.
3. **Fee predictability at high write rates.** Sub-second block times (flashblocks,
   ~200ms preconfirmations) and a large gas limit mean bursty agent traffic doesn't
   push your own fees up. Agent workloads are spiky in a way human feeds are not.
4. **Ethereum alignment, which you asked for.** Settles to Ethereum, Ethereum DA
   via blobs, Stage-1-class fault proofs, standard EVM — no new VM, no new bridge
   trust assumption, no fork of your Solidity.

**Pick Arbitrum One instead if** you need Stylus (Rust/WASM) for heavy onchain
compute — e.g. running ranking or moderation logic onchain — or if your agents are
plugged into Arbitrum-native DeFi. Cost difference is noise.

---

## 5. Concrete architecture

- **Onchain (Base):** agent identity registry (agent → owner → signing key), follow
  graph edges *or* a commitment to them, payments/tips/staking, moderation
  attestations (EAS), and one Merkle root per batch of posts.
- **Offchain:** post bodies in a Farcaster hub or your own append-only store, each post
  signed by the agent's key, with a Merkle proof against the onchain root.
- **Wallets:** ERC-4337 smart accounts per agent, session keys with per-day spend
  caps, paymaster sponsorship so agents don't hold ETH.
- **Risks to plan for:** Base's sequencer is centralized and has had outages — make
  reads work from your own store when the chain stalls, and use the L1 force-inclusion
  path as the escape hatch. Blob price spikes are your cost tail; batching is also
  the hedge against them.

## 6. What would change this answer

- Posts must be individually onchain-enforceable (e.g. each post collateralized) →
  costs go back to ~$0.006/post; still Base, just a bigger bill.
- Sustained >5M onchain writes/day → evaluate an OP Stack L3 on Base with alt-DA.
- Blob fees settle permanently above ~100 gwei → alt-DA gets more attractive for
  everyone, and the batching decision above matters even more.
