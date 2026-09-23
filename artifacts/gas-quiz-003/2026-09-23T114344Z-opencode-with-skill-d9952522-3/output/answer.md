# Deploy on Base

**Recommendation: Base (the Coinbase-backed OP-stack L2).** A social feed for AI
agents is the textbook L2 workload — high-frequency, low-value-per-action,
latency-sensitive, and L2-native. It is not a mainnet workload, even on a day
when mainnet gas happens to be cheap. Within the L2s, Base wins on ecosystem fit
for AI agents at a measured ~$0.002 per post; Optimism is the absolute cost
floor and Arbitrum is a solid third option (numbers below).

All measurements below were taken live on **Wed Sep 23, 2026, ~11:45 UTC**.
Snapshot — re-measure before you deploy.

---

## 1. Measured inputs

### Gas prices (live RPC readings)

| Chain | `cast gas-price` (suggested) | Median effective price paid in latest block (12 tx sample) |
|---|---|---|
| Ethereum mainnet | 0.365 gwei (publicnode; drpc 0.369, flashbots 0.061) | **2.17 gwei** (min 0.35, max 5.34) |
| Base | 0.006 gwei (base fee 0.005 gwei) | **0.01 gwei** (max 0.034) |
| Optimism | 0.001 gwei | **0.0001 gwei** |
| Arbitrum One | 0.0201 gwei | **0.0200 gwei** (uniform) |

### ETH price (live, not remembered)

- Chainlink ETH/USD feed (`0x5f4e...b8419`, 8 decimals): `latestRoundData`
  answer = 273,038,387,913 → **$2,730.38**, round timestamp Sep 23 2026 (fresh).
- Cross-check, Coinbase spot: $2,724.04 (within 0.2%). Use $2,730.

### L1 data fees — measured, not estimated

OP-stack chains charge a separate L1 data fee that is **not** in the gas price.
Measured via `GasPriceOracle.getL1Fee()` (`0x4200...000F`) on both chains for a
realistic post payload (324-byte calldata, see model below):

| | Base | Optimism |
|---|---|---|
| L1 fee for 324 B post | 5.11e-9 ETH (**$0.000014**) | 9.44e-9 ETH (**$0.000026**) |
| L1 base fee on the L1 | 0.314 gwei | 0.330 gwei |

Arbitrum folds L1 data cost into gas units. Measured from live receipts:
**7.56 gas units per calldata byte** (median across recent txs), priced at the
L2 gas price → a 324 B post adds ~2,450 gas units.

Two things the measurement surfaced:

- **FastLZ compression (Fjord fee model) is live on Base/OP.** 500 bytes of
  repetitive data cost *less* L1 gas (1,600) than 324 bytes of realistic text
  (2,865) because the L1 fee is charged on the *compressed* size. Keep post
  calldata in compressible encodings (plain text/hex, not random blobs).
- **Execution dominates on Base today**: 98.9% of a post's cost is L2 execution;
  the L1 data fee is 1.1%. With L1 base fee at ~0.31 gwei (post-Dencun blobs),
  the data fee is nearly free — but it *will* grow if L1 gas spikes, so keep
  posts compact anyway.

### Workload model (stated assumption)

A "post" = `post(string content, bytes32 parent, uint8 kind)` — one or two
SSTOREs, an event with the content, reads plus intrinsic gas ≈ **80,000 gas**.
Calldata measured with `cast calldata` for a 161-character body: **324 bytes**.
A like/repost is lighter (~40-60k gas); 80k is the conservative per-action
figure. Execution gas on L2s is the same code, so the assumption is constant
across chains and cancels out in the comparison.

## 2. Cost per post and at feed scale

`cost = gas_used × gas_price × ETH_USD (+ measured L1 data fee on OP-stack)`

| Chain | Execution | L1 data | **Total / post** | @ 100k posts/day |
|---|---|---|---|---|
| Mainnet (median paid today) | $0.474 | — | **$0.47** | **$47,430/day** |
| Mainnet (range in one block) | $0.077–$1.17 | — | $0.08–$1.17 | $7.7k–$117k/day |
| Arbitrum One | $0.00451 | folded in | **$0.0045** | **$451/day** |
| **Base** | $0.00218 | $0.000014 | **$0.0022** | **$220/day** |
| Optimism | $0.000022 | $0.000026 | **$0.00005** | **$5/day** |

(Using each chain's *median actually-paid* price; with the suggested
`cast gas-price` figures, Base is $0.0013/post → $132/day. Same ordering.)

## 3. Reasoning

**Why not mainnet, even at 0.365 gwei?**
Mainnet is genuinely cheap *right now* (0.06–0.37 gwei suggested across three
RPCs) — but one block sample spans 0.35→5.34 gwei actually paid, a 15x spread.
A social feed is high-frequency: agents post, reply, like, and tip
programmatically, so cost = per-action × volume × volatility. At even 100k
actions/day, today's *median* is $47k/day, and a routine congestion spike to
30+ gwei is $3+/action. Mainnet's comparative advantage is security for
low-frequency, high-value actions — the right pattern is to keep mainnet for
occasional high-value anchoring (e.g., settling a large agent-commerce trade)
and put the feed itself on an L2.

**Why Base over the other L2s?**
Optimism measured cheapest ($0.00005/post — 40x less than Base) and Arbitrum is
fine at 2x Base. But at social-feed scale the absolute differences are
$5/day vs $220/day — rounding error for any serious project. Base's margin over
Arbitrum and its gap to OP are both noise compared to its actual edge: it is
where the Ethereum AI-agent and social ecosystem is concentrating — Coinbase
smart-wallet/agent wallet infra, x402 agent payments, and the largest density of
social and agent apps. A social feed is only as good as its network effects;
your users' agents, wallets, and payment rails are already there. Base's
~2-second blocks also suit feed latency better than mainnet's 12s.

**Why Base's costs are this low (and what could change):**
Base's base fee is 0.005 gwei with the L1 data fee nearly free (blobs). Two
things could move this: Base L2 congestion (base fee rises — still sub-cent
until it rises ~100x) and L1 gas spikes (L1 data fee grows — capped exposure by
keeping posts compact and compressible per FastLZ). Even 10x-ing on both
axes keeps a post under 3 cents.

## 4. Practical notes for deploying on Base

- **Set EIP-1559 fields from Base at submission time, not from mainnet
  constants.** Measured now: base fee 0.005 gwei, suggested 0.006 gwei. A
  mainnet-style 2 gwei priority fee would overpay ~300x. Something like
  `maxFeePerGas = 0.015 gwei, maxPriorityFeePerGas = 0.001 gwei` has ample
  headroom today; re-derive at send time.
- Read the L1 data fee off `GasPriceOracle` (`getL1Fee(calldata)`) when
  budgeting, don't estimate it — and note it's charged on FastLZ-*compressed*
  calldata.
- Keep content in calldata/events (compressible), hashes rather than raw blobs
  for large media.
- Re-measure everything above at deploy time; the point of the numbers is the
  *ordering* (L2s 100–1000x cheaper than mainnet for this workload, Base at
  effectively-free), which is robust, not the exact snapshot.
