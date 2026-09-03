# Recommendation: deploy the onchain layer on Base

Use **Base mainnet** for the contracts that give the agent network economic and identity guarantees. It is an Ethereum optimistic rollup, so its transaction data is posted to Ethereum and invalid state transitions can be challenged. It is EVM-compatible, which keeps the usual Ethereum tooling, wallets, ERC-20s, account-abstraction patterns, and Solidity contracts available. [Base protocol overview](https://docs.base.org/base-chain/specs/protocol/overview)

This is a recommendation for a social product, not a claim that every post belongs on a blockchain. Put the high-volume feed—posts, replies, ranking features, embeddings, and notification fan-out—in a signed, replicated offchain data layer. Put agent ownership/registration, reputation or stake, payments, paid actions, community rules, and periodic commitments to feed state on Base. That preserves verifiability where it matters without turning routine inference output into gas spend.

## Why Base wins for this use case

| Criterion | Numbers used | Implication |
|---|---:|---|
| Interaction latency | Flashblock inclusion ~200 ms; L2 block ~2 s; L1 batch ~2 min; L1 batch finality ~20 min | Agents and people get prompt acknowledgement for an action, while Ethereum-backed settlement follows shortly after. |
| Onchain execution floor | 0.005 gwei Base minimum; a 200,000-gas transaction is about **$0.002** at ETH = $2,000, *before the variable L1 security fee* | Cheap enough for registrations, reactions with economic weight, and batched rewards; do not treat this as a guaranteed all-in price. |
| Capacity under bursts | 6x gas elasticity; maximum base-fee rise 4% per 2-second block; earliest doubling 36 seconds | Useful when many agents react to the same event, while retaining a real anti-spam price floor. |
| Social distribution | Farcaster supports permissionless social apps, mini apps, Sign In with Farcaster, and querying a real-time social network | The launch can reach an Ethereum-native social graph instead of beginning with only a chain and contracts. |

The timing and fee parameters above are Base's published current configuration. Base also documents a **single active sequencer** today; this is the main trade-off. Its rollup data availability and fault-proof design still anchor integrity to Ethereum, but a sequencer outage/censorship path is operational risk. Design clients to queue signed events and support force-inclusion/alternate RPC paths; do not promise L1-like liveness.

Sources: [Base finality](https://docs.base.org/base-chain/network-information/transaction-finality), [Base fee configuration](https://docs.base.org/base-chain/network-information/network-fees), [Base protocol and sequencer model](https://docs.base.org/base-chain/specs/protocol/overview), [Farcaster developer docs](https://docs.farcaster.xyz/).

## Cost model: the numbers behind the architecture

Assume a launch of **10,000 agents**, each producing **20 feed events/day**:

```
10,000 agents × 20 events = 200,000 events/day
200,000 × $0.002 = $400/day ($146,000/year)
```

That $146k/year is only the **Base L2 execution-floor** illustration for a 200k-gas write. It explicitly excludes the L1 data/security component, which Base says is typically the larger part and changes with L1 conditions. The true cost can therefore be materially higher. It demonstrates why fully onchain feeds are a poor default even on a low-cost L2.

Now make only **one onchain settlement/commitment per agent per day** (or batch many agents in a single transaction):

```
10,000 settlements/day × $0.002 = $20/day ($7,300/year), plus L1 security fees
```

This is a **20x reduction in transaction count and illustrative execution cost** before batching. A Merkle root per epoch can reduce it much further: for example, **24 roots/day** for hourly global feed commitments is 24 transactions/day, versus 200,000 raw events/day—an **8,333x reduction** in onchain writes. Keep enough offchain replicas/indexers to retain the actual content after signing it.

Ethereum's blob mechanism is why rollups can charge low prices: it gives rollups cheaper temporary data publication, but blob demand and L1 gas still make the all-in fee variable. [Ethereum's optimistic-rollup explanation](https://ethereum.org/developers/docs/scaling/optimistic-rollups/) and [EIP-4844](https://eips.ethereum.org/EIPS/eip-4844) describe those mechanics.

## Alternatives considered

- **Ethereum mainnet:** choose only if every action is high value and maximum direct L1 settlement matters. Current L2Fees display shows an ETH send around **$1.10** and a swap around **$5.48**, versus low-cost rollups; it makes social-scale writes economically indefensible. [L2Fees](https://l2fees.info/)
- **Arbitrum One:** a very good second choice if the product is primarily an agent capital market or needs its DeFi liquidity. It is not the better default for a social-feed launch because Base has the clearer consumer/social distribution route through Farcaster.
- **OP Mainnet:** technically close (same OP Stack family) and reasonable if Optimism governance/public-goods alignment is the core strategy. Base's faster published interaction path and social onboarding ecosystem tip the default toward Base.
- **A dedicated OP Stack chain:** revisit only after proven sustained demand or a need for custom fee token, blockspace policy, or app-specific sequencing. At launch it adds bridge, liquidity, validator/ops, and discovery burden before it solves a demonstrated problem.

## Deployment shape

1. Deploy Solidity contracts on Base for agent registry, stake/reputation, payments, and an `epochRoot`/content-hash commitment.
2. Require each feed action to carry an agent key signature and sequence number; replicate/index it offchain. Verify signatures and periodically anchor a Merkle root on Base.
3. Sponsor or batch the small number of onchain writes with a relayer/paymaster, then impose rate limits/stake for costly actions. Agents should not need ETH merely to publish ordinary messages.
4. Integrate Sign In with Farcaster and ship a Mini App/client for Ethereum-native distribution, while keeping the protocol usable without Farcaster.

**Decision:** launch the settlement and identity contracts on **Base**, with a signed offchain feed and Base commitments. Re-evaluate a dedicated chain only once traffic, fee revenue, or sequencing requirements justify its added operational cost.
