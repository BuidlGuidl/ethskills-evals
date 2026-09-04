# Recommendation: deploy the feed contracts on Base

An AI-agent social feed is likely to have many low-value writes: publish a
post, follow, react, attest, or update an agent profile. That is a poor fit
for Ethereum L1, where every one of those actions competes for expensive
blockspace. Base is EVM-compatible, so it preserves the normal Solidity and
wallet/tooling path while making those writes practical. Keep bulky post
content off-chain and put only identities, hashes, permissions, and economic
actions on-chain.

## Live cost snapshot (queried 2026-08-27)

| Input | Ethereum mainnet | Base |
|---|---:|---:|
| RPC gas price | 133.491758 gwei | 0.006 gwei |
| ETH/USD spot price | $2,516.075 | $2,516.075 |
| 100,000-gas post: execution cost | 0.01334918 ETH = **$33.59** | 0.00000060 ETH = **$0.00151** |
| 1,500,000-gas deployment: execution cost | 0.20023764 ETH = **$503.81** | 0.000009 ETH = **$0.02264** |

The gas prices were read from the chains' RPCs (`cast gas-price`) and ETH/USD
from Coinbase's ETH-USD spot endpoint. The 100,000-gas post and
1,500,000-gas deployment are explicit planning assumptions, not measurements
of a contract that does not yet exist.

Formula used:

```
USD cost = gas used × gas price (gwei) × 10^-9 × ETH/USD
```

For the representative post on mainnet:

```
100,000 × 133.491758 × 10^-9 × 2,516.075 = $33.5875
```

For Base execution:

```
100,000 × 0.006 × 10^-9 × 2,516.075 = $0.0015096
```

## Important Base fee caveat

Base is an OP Stack L2, so a transaction also has an L1 data fee. It must be
measured separately rather than assumed to be zero. As a live check, a recent
Base contract transaction used 135,292 gas at an effective price of 0.125
gwei: its execution fee was 0.0000169115 ETH ($0.04255), and the receipt's
`l1Fee` was 1,068,447,819 wei (0.000000001068 ETH, about $0.00000269) at that
moment. L1 data cost depends mainly on calldata/compression, so do not scale
that example by EVM gas; measure a real post and deployment receipt before
setting a user fee or budget.

## Why this is the right trade-off

At the measured prices, the execution component of the representative post is
about **22,250×** lower on Base ($33.59 / $0.00151). That difference is large
enough to change the product: agents can post and react routinely instead of
reserving on-chain activity for rare, high-value events. Ethereum mainnet
would make sense only if the feed's core value is L1 settlement/security and
actions are intentionally infrequent and valuable. For an active social feed,
deploy on Base, use off-chain content plus on-chain references, and re-check
Base execution and L1-data fees from receipts immediately before launch.

