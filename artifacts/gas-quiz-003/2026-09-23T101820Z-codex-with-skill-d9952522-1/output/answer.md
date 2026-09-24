# Recommendation: deploy the social feed on Base

Deploy the feed contracts on **Base**, and keep Ethereum mainnet for optional
high-value anchoring, governance, or settlement. A social feed for AI agents is
high-frequency and low-value per action: posts, follows, likes, replies, and
agent-to-agent interactions should be cheap enough that the product can use them
freely. Base gives that L2 cost profile while staying inside the Ethereum
ecosystem and offering strong consumer/social distribution.

## Numbers used

Measured on 2026-09-23 at about 10:19 UTC:

| Item | Raw reading | Converted value |
| --- | ---: | ---: |
| ETH/USD | Coinbase spot: `2731.775` | $2,731.775 per ETH |
| Ethereum mainnet gas price | `330236508` wei | 0.330236508 gwei |
| Base gas price | `6000000` wei | 0.006 gwei |
| Optimism gas price | `1000569` wei | 0.001000569 gwei |
| Arbitrum gas price | `20014000` wei | 0.020014 gwei |

For Base, I also checked recent receipts because OP-stack L2s charge an L1 data
fee separately from execution gas. Recent Base receipts showed:

| Receipt sample | gasUsed | effectiveGasPrice | l1Fee | l1Fee in USD |
| --- | ---: | ---: | ---: | ---: |
| Simple tx | 26,742 | 0.005500004 gwei | 2,769,537,408 wei | $0.0000076 |
| Larger tx | 244,499 | 0.00501 gwei | 20,366,053,667 wei | $0.0000556 |
| Simple tx | 28,845 | 0.00500001 gwei | 2,769,537,408 wei | $0.0000076 |
| Larger tx | 628,412 | 0.005 gwei | 2,769,537,408 wei | $0.0000076 |
| Larger tx | 546,852 | 0.005 gwei | 3,291,841,698 wei | $0.0000090 |

## Cost model

I used this formula for mainnet execution gas:

```text
cost_usd = gas_used * gas_price_gwei * 1e-9 * eth_usd
```

For Base, I used the L2 execution cost plus observed L1 data fee:

```text
cost_usd = (gas_used * gas_price_gwei * 1e-9 + l1_fee_eth) * eth_usd
```

For a feed, I assume the app does **not** store full post bodies onchain.
Instead, put large content in an offchain data layer such as IPFS, Arweave, or a
purpose-built indexer, and write compact onchain actions: author, content hash or
URI, target id, and event data. A representative write of 80,000 gas is a
reasonable planning number for a simple post/follow/reaction style action. More
complex writes may be 100,000 to 200,000 gas.

## Per-action cost estimates

Using an 80,000 gas representative write:

| Chain | Execution cost | Added L1 data fee | Estimated total |
| --- | ---: | ---: | ---: |
| Ethereum mainnet | $0.0722 | included in L1 gas | $0.0722 |
| Base | $0.00131 | about $0.000008 to $0.000056 from sampled receipts | about $0.00132 to $0.00137 |

For a heavier 200,000 gas action:

| Chain | Estimated total |
| --- | ---: |
| Ethereum mainnet | $0.1804 |
| Base execution plus sampled L1 data fee | about $0.00329 to $0.00333 |

For a one-time 2,000,000 gas deployment:

| Chain | Estimated execution cost |
| --- | ---: |
| Ethereum mainnet | $1.8043 |
| Base | $0.0328 plus deployment-specific L1 data fee |

Mainnet is not wildly expensive in this snapshot, but the repeated-action
difference still matters. At 1,000,000 feed writes, the 80,000 gas estimate is
about **$72,171 on mainnet** versus about **$1,320 to $1,370 on Base** at the
measured prices.

## Why Base

Base is the best default for this product because:

1. **The workload is feed-like.** Social actions are frequent, low-value, and
   latency-sensitive. That points to an L2, not mainnet.
2. **The cost is comfortably low.** A representative onchain action is around a
   tenth of a cent on Base with current measured fees, even after including the
   observed L1 data component.
3. **The Ethereum connection remains strong.** Base settles to Ethereum, uses ETH
   as the native gas token, and fits standard EVM tooling, wallets, indexers, and
   bridging flows.
4. **The ecosystem fit is good for social apps.** Base has strong consumer app
   distribution and a social/creator/user-account ecosystem that is more relevant
   to an AI-agent feed than mainnet settlement prestige alone.
5. **Mainnet can still be used where it matters.** If the agents need scarce
   identity, high-value reputation checkpoints, staking, governance, or final
   settlement, anchor those pieces to Ethereum mainnet while keeping routine feed
   actions on Base.

Optimism showed an even lower execution gas quote in this snapshot, so if the
only requirement were the absolute lowest L2 execution fee, I would benchmark
Optimism more deeply before launch. But the measured Base costs are already
sub-cent for the expected workload, and Base's distribution and consumer/social
ecosystem are more valuable for this product than shaving fractions of a cent
from already tiny writes.

## Final decision

Use **Base** for the feed. Design the protocol so the chain stores compact,
verifiable social actions and commitments, while feed rendering, search, ranking,
and large content live offchain. Use Ethereum mainnet only for the pieces whose
value justifies L1 settlement.
