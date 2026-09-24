# Which Ethereum chain for an AI-agent social feed?

**Recommendation: Base (OP Stack L2). OP Mainnet is the equally-defensible
alternative. Ethereum L1 is disqualified — not by per-transaction price, but by
write frequency.**

All numbers below were measured on 2026-09-23, not recalled. Method and raw
readings are in the appendix so you can re-run them before you commit.

---

## 1. What the workload actually costs

I wrote the minimal version of the contract you described — `post(string,uint256)`,
`follow(address)`, `like(uint256)`, with an events-plus-one-storage-slot design —
and measured real `gasUsed` end-to-end against a node, rather than guessing.

| Operation | gas used |
|---|---|
| Deploy `AgentFeed` | 493,375 |
| `post` (18-byte body) | 53,092 |
| `post` (280-byte body) | 59,368 |
| `follow` | 45,573 |
| `like` (cold slot) | 45,596 |
| `like` (warm slot) | 28,496 |

Note `post` is nearly flat in body length: 280 chars costs only 12% more than 18
chars, because the body goes into an event (log data), not storage. That design
choice matters more than the chain choice for any *single* transaction.

## 2. Live prices at time of writing

- **ETH/USD: $2,730.005** (Coinbase spot)
- **Ethereum L1: 0.390061 gwei** (`cast gas-price` → 390,060,741 wei)
- **Base: 0.006000 gwei** (6,000,000 wei); L1 data fee ≈ 3.9e-9 ETH/tx
- **OP Mainnet: 0.001001 gwei** (1,000,580 wei); L1 data fee ≈ 5.9e-9 ETH/tx
- **Arbitrum One: 0.020032 gwei** (20,032,000 wei)

L1 data fees were read off real receipts in the current block, not estimated.

## 3. Cost per action

`cost_usd = gas_used × gas_price_gwei × 1e-9 × eth_usd` (+ `l1_fee_eth × eth_usd`
on the OP Stack chains).

| | Ethereum L1 | Base | OP Mainnet | Arbitrum One |
|---|---|---|---|---|
| Deploy | **$0.5254** | $0.008092 | $0.001364 | $0.026981 |
| `post` (short) | **$0.056536** | $0.000880 | $0.000161 | $0.002903 |
| `post` (280B) | $0.063219 | $0.000983 | $0.000178 | $0.003247 |
| `follow` | $0.048529 | $0.000757 | $0.000141 | $0.002492 |
| `like` | $0.030344 | $0.000477 | $0.000094 | $0.001558 |

Sanity check on one cell, since a dropped 1e9 is the classic failure mode:
53,092 × 0.390061 × 1e-9 = 2.07091e-5 ETH; × $2,730.005 = **$0.0565**. That is
consistent with a ~0.39 gwei L1 — mainnet is genuinely *cheap right now*.

## 4. Where it breaks: frequency

A feed for AI agents is a high-frequency, low-value-per-action workload. Agents
post on a loop; humans do not. At a modest **5,000 posts/day** (say 100 agents ×
50 posts):

| Chain | per day | per month | per 1M posts |
|---|---|---|---|
| Ethereum L1 | $282.68 | **$8,480** | $56,536 |
| Base | $4.40 | $132.04 | $880 |
| OP Mainnet | $0.81 | $24.17 | $161 |
| Arbitrum One | $14.52 | $435.52 | $2,903 |

That is the whole argument. Mainnet at 5.7¢ a post is not expensive for a
one-off action — it would be a perfectly reasonable home for a registry, a
governance vote, or an agent identity NFT. It is untenable as the write path for
a firehose.

**And 0.39 gwei is a floor, not a fixture.** Mainnet gas has repeatedly spent
days at 20+ gwei. Re-price the same post at 20 gwei and it is **$2.90**, or
$14,500/day at 5,000 posts. Your unit economics would be hostage to L1
congestion you have no control over. The L2s in this table price at 0.001–0.02
gwei and are insulated from that by design.

## 5. Base vs. OP Mainnet vs. Arbitrum

Cost does **not** decide this. Base ($132/mo) vs. OP ($24/mo) is a ~$108/month
difference at the volume modeled — below the noise floor of a single engineer's
time. Pick on non-cost grounds:

- **Base** — recommended. The densest concentration of agent and social
  infrastructure in the Ethereum ecosystem (Farcaster and its client ecosystem,
  agent wallet/session-key tooling, Coinbase on-ramps and embedded wallets). For
  a *social* feed, the distribution and the existing social graph are worth far
  more than $108/month. OP Stack, so you inherit the Superchain and standard
  Optimism tooling.
- **OP Mainnet** — cheapest measured, ~5.5× under Base, identical OP Stack
  developer experience. Choose this if you expect to be one or two orders of
  magnitude above the volume modeled here, or if you want tighter alignment with
  Optimism governance/RetroPGF.
- **Arbitrum One** — 3.3× Base's cost here and outside the OP Stack fee model
  (ArbOS folds L1 data cost into `gasUsed` rather than exposing a separate
  `l1Fee`, so it must be measured on its own terms). No offsetting advantage for
  this specific workload.

All three are Ethereum L2s settling to Ethereum L1, so the ecosystem commitment
is intact either way — you keep ETH as the gas token, Ethereum security
settlement, and the full EVM/Foundry/viem toolchain.

## 6. Two consequences for how you build

**Optimize execution gas, not calldata.** On Base right now the split per post is
execution ≈ 3.19e-7 ETH vs. L1 data fee ≈ 3.9e-9 ETH — **the L1 data fee is about
1.2% of the bill.** The post-Dencun blob regime made calldata nearly free here.
Compressing post bodies or batching to shrink calldata would buy you almost
nothing; eliminating the `authorOf[id] = msg.sender` SSTORE (a 20,000-gas cold
write, ~38% of the post) would buy you real money. That slot is recoverable from
the `Posted` event's indexed `author` field if your indexer is the source of
truth for reads.

**Do not hardcode fee fields.** Derive `maxFeePerGas` / `maxPriorityFeePerGas`
from the target chain immediately before each submission. An L1 priority-fee
constant ported to Base would overpay by orders of magnitude; a stale one would
get you stuck in the mempool. And re-measure before you launch — every price in
this document is a snapshot of 2026-09-23.

---

## Appendix: how these numbers were obtained

```bash
# Prices (all fetched live, 2026-09-23)
cast gas-price --rpc-url https://ethereum-rpc.publicnode.com   # 390060741 wei
cast gas-price --rpc-url https://mainnet.base.org              #   6000000 wei
cast gas-price --rpc-url https://mainnet.optimism.io           #   1000580 wei
cast gas-price --rpc-url https://arb1.arbitrum.io/rpc          #  20032000 wei
curl -s https://api.coinbase.com/v2/prices/ETH-USD/spot        # 2730.005
```

L1 data fees: pulled `l1Fee` from `eth_getTransactionReceipt` on six real
transactions in the then-current head block of each chain (Base #51,684,983;
OP #157,280,269). Base receipts showed `l1Fee` of 3.9e-9–7.0e-9 ETH; OP showed
5.9e-9–1.03e-8 ETH. Not estimated.

Gas used: the `AgentFeed` contract above, compiled with solc 0.8.37, deployed to
a local node and exercised with `cast send`; figures are full-transaction
`gasUsed` from receipts (intrinsic 21,000 included), with cold/warm storage
states distinguished. Reproduce with `forge test --gas-report`.

Caveat on `like`: the cold-slot figure (45,596) applies to the first like on a
given post; steady-state is the warm figure (28,496). The tables use the warm
number, which is the right one for a busy feed.
