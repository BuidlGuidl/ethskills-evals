# Which Ethereum chain for an AI-agent social feed?

**Recommendation: Base.** Second choice: OP Mainnet. Not L1 mainnet — but for a
throughput reason, not the reason you'd expect.

All figures below were measured live, not recalled.

## Measurements (2026-09-23 ~10:40 UTC)

ETH/USD: **$2,735.75** (Coinbase spot)

`cast gas-price` (base fee + suggested tip), raw wei → gwei:

| Chain | wei | gwei |
|---|---|---|
| Ethereum mainnet | 312,329,252 | 0.3123 |
| Base | 6,000,000 | 0.0060 |
| OP Mainnet | 1,000,630 | 0.0010 |
| Arbitrum One | 20,148,000 | 0.0201 |
| Zora | 1,000,252 | 0.0010 |

L1 data fee for OP-stack chains, from `GasPriceOracle.getL1Fee(bytes)` at
`0x420...00F` with a 320-byte serialized tx (a post with a ~200-byte message):

- Base: 3,156,658,616 wei = 0.00000316 ETH = **$0.0000086**
- OP Mainnet: 4,511,544,079 wei = 0.00000451 ETH = **$0.0000123**

Sanity check against real receipts pulled from the latest block on each chain:
Base's last tx paid an L1 fee that was 0.2% of its total; OP's was 83% of a very
cheap total. Post-Dencun, **the L1 data fee is negligible on both** — the
execution half is what matters, so don't spend effort compressing calldata.

## Cost per operation

`cost_usd = gas_used × gas_price_gwei × 1e-9 × eth_usd  (+ l1_fee_eth × eth_usd)`

Gas assumptions — a feed that emits post content as an event (not stored) and
keeps only a follow/like mapping in storage:

- post: 55,000 (event with ~200-byte string + nonce bump)
- follow: 46,000 (one cold SSTORE)
- like: 29,000 (one warm-ish SSTORE)
- register agent: 80,000
- deploy: 1,500,000

| Op | Mainnet | Base | OP | Arbitrum |
|---|---|---|---|---|
| post | $0.0470 | $0.00091 | $0.00016 | $0.0030 |
| follow | $0.0393 | $0.00076 | $0.00014 | $0.0025 |
| like | $0.0248 | $0.00049 | $0.00009 | $0.0016 |
| register | $0.0684 | $0.00132 | $0.00023 | $0.0044 |
| deploy | $1.28 | $0.0247 | $0.0042 | $0.0827 |

At 1M posts/day:

| Mainnet | Base | OP | Arbitrum |
|---|---|---|---|
| $46,995/day ($17.2M/yr) | $911/day ($333k/yr) | $163/day ($59k/yr) | $3,032/day ($1.1M/yr) |

(Arbitrum's L1 posting cost is charged as *extra gas units*, not a separate
`l1Fee`, so its column is a mild underestimate at a fixed 55,000 gas.)

## Reasoning

**Mainnet is not expensive right now.** At 0.3123 gwei a post costs 4.7 cents
and a deploy costs $1.28. If this were a low-frequency, high-value app — a
registry, a settlement contract, an agent identity root — mainnet would be
perfectly viable today and I would not push you off it. The reflex "L1 is too
expensive, go L2" is not supported by the current reading.

**The disqualifier is throughput, not price.** At 55,000 gas per post and a
60,000,000 gas L1 block every 12s, the *entire* Ethereum L1 absorbs about 91
posts/sec — and that assumes the chain does nothing else. AI agents post at
machine rates, not human rates; a few thousand active agents saturate that.
Base's current block is 400,000,000 gas every 2s: ~3,600 posts/sec of headroom,
40× L1, with 6× faster confirmation. OP Mainnet's 40,000,000/2s gives ~364
posts/sec.

**Base over OP Mainnet**, despite OP being ~5.6× cheaper per post ($0.00016 vs
$0.00091). Both are rounding errors against any plausible revenue; $333k/yr at a
million posts a day is a real number but it is a scale you'd be delighted to
reach, and Base's 10× throughput headroom is the constraint that actually binds.
Base also has the deepest agent/consumer-app ecosystem and the largest share of
existing agent wallets, which matters more than a $0.00075 delta. If your volume
profile is genuinely enormous and latency-tolerant, OP Mainnet is the cost play.

**Arbitrum** is 3.3× Base's per-post cost and offers no compensating advantage
for this workload. **Zora** matches OP on price but is a much thinner ecosystem
for a general agent feed.

All of these are Ethereum L2s settling to L1, so the ecosystem commitment holds.

## Caveats

- Mainnet gas at 0.31 gwei is a low reading and is the most volatile number
  here; it can move 10–50× within a day. The L2 figures are far more stable.
  Re-measure before quoting these to anyone.
- Set EIP-1559 fields from the target chain immediately before submission. Do
  not port a mainnet priority-fee constant to Base — `cast base-fee` on Base,
  and a tip in the single-digit *wei* range, not gwei.
- Re-measure the L1-vs-execution split on your own receipts once you have real
  traffic before optimizing either half.
