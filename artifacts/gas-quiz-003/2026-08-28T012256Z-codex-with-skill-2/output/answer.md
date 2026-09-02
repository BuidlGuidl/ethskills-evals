# Recommendation: deploy the social-feed protocol on Base

Base is the best default for an AI-agent social feed: it is an Ethereum L2, so
the contracts and assets remain in the Ethereum ecosystem, while its lower
per-action cost makes frequent agent posts, follows, reactions, and attestations
practical. Keep a small, high-value settlement or governance component on
Ethereum mainnet only if its extra neutrality/liquidity is specifically needed.

## Measurements used

Snapshot taken 2026-08-27. RPC values are volatile and must be refreshed before
a real deployment or transaction.

| Input | Ethereum mainnet | Base |
|---|---:|---:|
| RPC gas price | 53,249,797 wei = **0.053249797 gwei** | 6,000,000 wei = **0.006000000 gwei** |
| Base fee | 57,073,690 wei | 5,000,000 wei |
| ETH/USD | **$2,528.12** | same ETH price |

For Base I also queried its on-chain `GasPriceOracle`, because an OP-stack
transaction has an Ethereum data-publication fee in addition to L2 execution:

| Base oracle input | Value |
|---|---:|
| L1 base fee | 62,560,262 wei |
| `baseFeeScalar` | 2,269 |
| `blobBaseFeeScalar` | 1,055,762 |

## Cost model and results

Formula for the execution portion:

```text
cost (ETH) = gas used × gas price (gwei) × 1e-9
cost (USD) = cost (ETH) × $2,528.12/ETH
```

I used two planning assumptions: a 1,500,000-gas deployment with 20 KB of
init-code/transaction data, and one 100,000-gas social action carrying 300
bytes of data. The contract and posting format can change these assumptions,
but they are intentionally conservative enough for early sizing. Base's L1
data fee was measured by calling `GasPriceOracle.getL1Fee` against a
representative serialized transaction of each size.

| Operation | Ethereum mainnet | Base execution | Base L1 data fee | Base total |
|---|---:|---:|---:|---:|
| Deploy (1.5M gas, 20 KB) | 0.000079874696 ETH = **$0.201933** | 0.000009000000 ETH = $0.022753 | 0.000000001332 ETH = $0.00000337 | **$0.022756** |
| One post/action (100k gas, 300 B) | 0.000005324980 ETH = **$0.013462** | 0.000000600000 ETH = $0.001517 | 0.000000000563 ETH = $0.00000142 | **$0.001518** |

At this snapshot, the modeled Base social action is about **8.9x** cheaper
than mainnet ($0.001518 vs. $0.013462), and the modeled deployment is about
**8.9x** cheaper ($0.022756 vs. $0.201933). The key product point is not the
one-time deployment difference: a social network of autonomous agents creates
many low-value writes, so recurring cost and fast L2 UX matter much more.

## Why this fits the product

- Base preserves EVM compatibility and Ethereum settlement, so normal Solidity
  tooling, wallets, ERC-20/721/1155 assets, and Ethereum bridges work naturally.
- Low-cost writes better fit a feed. Do not put the full post body on-chain:
  store content/media off-chain (for example, content-addressed storage) and
  publish a hash, URI, author, timestamp, and optional moderation/attestation
  data on Base.
- The feed should tolerate sequencer and bridge assumptions: index events off
  chain, make content available independently, and document the withdrawal
  path for any assets held by the protocol.

## Decision boundary

Choose Ethereum mainnet instead only if writes will be rare and each action is
high-value enough that mainnet's direct security/liquidity is worth the extra
friction. For a high-frequency AI-agent feed, deploy the application contracts
on Base now; reassess with real transaction receipts after a prototype, since
Base fees and the L1 data component change with network conditions and your
actual calldata.
