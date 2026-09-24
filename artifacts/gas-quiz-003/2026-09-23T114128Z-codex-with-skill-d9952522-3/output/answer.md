# Recommendation: deploy the feed on Base

Deploy the social-feed contracts on **Base mainnet**, and keep Ethereum mainnet only for slow, high-value roots such as an optional canonical agent registry, treasury, or governance checkpoint.

For an AI-agent social feed, the hot path is not a rare settlement transaction. It is frequent, low-value actions: post, reply, follow, like, attest, quote, moderate, update reputation, and maybe sponsor gas for agents. Those actions need to be cheap enough to do constantly, fast enough to feel live, and accessible enough that other builders and wallets can plug in. Base is the best fit because it is still Ethereum-aligned, uses ETH as gas, is EVM-compatible, has very low per-action cost, and has stronger distribution/onboarding than the cheaper but less socially strategic alternatives.

I would not put every feed item fully on-chain. Put the durable social primitives on Base and keep bulky content off-chain:

- On Base: agent identity pointer, follow graph events, content hashes, moderation/reputation attestations, payments/tips, permissions, and protocol state.
- Off-chain or DA/storage layer: full text, media, embeddings, model traces, and feed indexes.
- On Ethereum L1: only final settlement or canonical registry checkpoints if they are worth paying L1 fees for.

## Numbers used

Collected on **2026-09-23 at about 11:43 UTC**.

ETH/USD spot used for conversions: **$2,719.075** from Coinbase spot API.

Latest completed-hour fee data from growthepie was for **2026-09-23T10:00:00Z**. I used median transaction cost because it reflects what users actually paid, including L2 fee mechanics that a simple `gasPrice * gasUsed` calculation misses.

| Chain | Observed median tx fee | Cost for 1,000,000 feed actions at median fee | Observed TPS in same hour | Comment |
| --- | ---: | ---: | ---: | --- |
| OP Mainnet | $0.000033 | $33 | 18.26 | Cheapest among the mature chains in this sample, but weaker distribution fit for a social app. |
| Unichain | $0.000138 | $138 | 7.50 | Very cheap, but more DeFi-native and less obviously suited to a social network launch. |
| **Base** | **$0.000849** | **$849** | **121.25** | Cheap enough for high-frequency feed actions, with much stronger app/user/onboarding gravity. |
| Arbitrum One | $0.004312 | $4,312 | 17.95 | Strong ecosystem, but materially more expensive for a write-heavy feed. |
| Ethereum mainnet | $0.112322 | $112,322 | 20.26 | Fine for settlement, too expensive and capacity-constrained for the feed hot path. |

Direct RPC gas-price readings, converted from wei to gwei:

| Chain | `cast gas-price` | Gwei | 80k-gas write, execution-only | 1.5M-gas deploy, execution-only |
| --- | ---: | ---: | ---: | ---: |
| Ethereum mainnet | 313,982,502 wei | 0.313982502 | $0.068299 | $1.2806 |
| Base | 6,000,000 wei | 0.006000000 | $0.001305 | $0.0245 |
| Arbitrum One | 20,086,000 wei | 0.020086000 | $0.004369 | $0.0819 |
| OP Mainnet | 1,000,658 wei | 0.001000658 | $0.000218 | $0.0041 |

The execution-only table is a sanity check, not the main comparison. On OP-stack L2s such as Base, each transaction has an L2 execution fee plus an L1 security/data fee. BaseHub documents this fee split and notes that the L1 component is often the larger part. That is why the growthepie observed-fee table is the better decision input.

## Why Base wins

**1. The cost is low enough for agent behavior.**  
At the observed median of about **$0.000849 per transaction**, one million on-chain feed actions cost about **$849** before any batching or sponsorship optimizations. That is not the absolute cheapest option, but it is already cheap enough that product design can focus on spam controls, ranking, and identity rather than rationing every write.

**2. Mainnet is the wrong hot path.**  
Ethereum mainnet's observed median fee was about **$0.112322**, or about **132x Base's observed median fee**. One million actions would be about **$112k** on mainnet versus about **$849** on Base. Even though mainnet gas was unusually low at the moment of measurement, it is still a poor place for high-frequency social writes.

**3. OP Mainnet is cheaper, but Base is the better product chain.**  
OP Mainnet was much cheaper in the latest hour, about **$0.000033** median. If the only goal were minimizing cost for machine-to-machine messages, OP Mainnet would be a serious candidate. For a social feed, though, the chain is part of distribution. Base has stronger consumer onboarding, Coinbase and Base Account/Smart Wallet surface area, more visible app culture, and much higher observed activity in this sample. Paying roughly **0.085 cents** per action instead of **0.0033 cents** is worth it if it improves network formation.

**4. It keeps you inside Ethereum without inheriting L1 UX.**  
Base is an Ethereum L2, uses ETH for gas, and inherits Ethereum settlement/security assumptions through the rollup model. You keep EVM tooling, Solidity, account abstraction patterns, indexers, wallets, and bridges, while avoiding L1 costs for every feed interaction.

**5. It gives you room to sponsor actions.**  
For AI agents, gas sponsorship matters. You probably do not want every agent to manage ETH balances for every micro-action. Base's low fees make paymasters, session keys, smart accounts, batched writes, and app-sponsored posting economically realistic.

## Design implications

Use Base for the feed protocol, but design it as a protocol with portable data:

- Emit compact events for posts/replies/follows, with content addressed by hash or URI.
- Batch noisy agent activity where possible.
- Put anti-spam economics in the protocol: stake, rate limits, allowlists, reputation, or refundable bonds.
- Keep an L1 escape hatch for a canonical registry or governance root if neutrality becomes more important than cost.
- Avoid hard-coding Base assumptions so a future Superchain or multi-L2 deployment is possible.

## Sources and measurement commands

- growthepie fee API: https://api.growthepie.com/v1/fees/table.json
- growthepie methodology page: https://www.growthepie.com/answers/lowest-fee-ethereum-l2
- Coinbase ETH/USD spot API: https://api.coinbase.com/v2/prices/ETH-USD/spot
- Base fee documentation: https://basehub.org/network/network-fees/
- Ethereum gas documentation: https://ethereum.org/developers/docs/gas/

Commands used:

```bash
curl -s https://api.coinbase.com/v2/prices/ETH-USD/spot
curl -s https://api.growthepie.com/v1/fees/table.json

cast gas-price --rpc-url https://ethereum-rpc.publicnode.com
cast gas-price --rpc-url https://mainnet.base.org
cast gas-price --rpc-url https://arb1.arbitrum.io/rpc
cast gas-price --rpc-url https://mainnet.optimism.io
```

Raw readings:

```text
ETH/USD: 2719.075

growthepie latest completed hour: 2026-09-23T10:00:00Z
arbitrum: median $0.0044, native transfer $0.0012, TPS 17.9467
base: median $0.0009, native transfer $0.0004, TPS 121.2525
ethereum: median $0.1137, native transfer $0.0448, TPS 20.2625
optimism: median 0.000000012237253341 ETH = $0.000033, native transfer $0.0001, TPS 18.2636
unichain: median 0.000000050732603366 ETH = $0.000138, native transfer $0.0009, TPS 7.4969

cast gas-price:
ethereum: 313982502 wei
base: 6000000 wei
arbitrum: 20086000 wei
optimism: 1000658 wei
```
