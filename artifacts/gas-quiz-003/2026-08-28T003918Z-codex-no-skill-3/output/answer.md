# Recommendation: deploy the onchain parts on Base

Use **Base mainnet** for agent identities, staking/escrow, paid actions, and
settlement.  Keep feed posts, replies, and likes as signed messages in a
replicated database/protocol (Farcaster is a strong interoperability option),
with only a content hash or periodic Merkle-root checkpoint on Base.

That is deliberately not a recommendation to put every item in the feed in a
smart contract. Agents can produce enormous volumes of low-value activity;
putting text onchain makes cost, latency, and spam all worse without making a
chronological feed more useful. Farcaster's design is a useful precedent:
social actions are signed messages, hubs synchronize the message graph, and
only identity/key-management state needs a contract.

## Numbers and assumptions

Base documents a **minimum L2 base fee of 0.005 gwei** and gives a useful
all-in reference point: a typical **200,000-gas** transaction costs about
**$0.002 at ETH = $2,000**.  Base fees include L2 execution plus an Ethereum
data-publication component, so this is a planning estimate rather than a price
guarantee.

Planning workload (replace these with measured product telemetry):

| Input | Value | Calculation |
|---|---:|---|
| Active agents | 10,000 | assumption |
| Feed actions per agent per day | 10 | post/reply/react, signed offchain |
| Feed actions per month | 3,000,000 | 10,000 x 10 x 30 |
| Onchain settlement rate | 1 per 100 actions | 1% of actions; batch actions into roots/escrows |
| Base onchain transactions/month | 30,000 | 3,000,000 / 100 |
| Conservative Base fee/settlement tx | $0.002 | Base's 200,000-gas reference |
| Monthly settlement gas | **$60** | 30,000 x $0.002 |

The raw L2 execution floor illustrates why batching matters but is not the
number to budget against:

```
200,000 gas x 0.005 gwei/gas = 1,000 gwei = 0.000001 ETH
0.000001 ETH x $2,000/ETH = $0.002
```

At the same $0.002 planning price, recording *all* 3,000,000 actions as
separate onchain transactions would be **$6,000/month**.  Batching just 100:1
reduces that to **$60/month** (a 100x reduction). In production, quote each
transaction through Base's `GasPriceOracle.getL1Fee` before submission and set
a sponsorship budget with headroom: L1 data fees and ETH price move.

For contrast, a simple Ethereum-L1 comparison at a *stated scenario*, not a
claim about today's gas, is:

```
200,000 gas x 10 gwei x $2,000/ETH = $4 per transaction
30,000 transactions/month x $4 = $120,000/month
```

Under those inputs Base's $60 planning total is roughly **2,000x lower** than
the $120,000 L1 total.  The exact ratio changes with L1 gas, ETH price, and
serialized transaction size; it should not be treated as a fixed protocol
property.

## Why Base wins here

1. **Cost at agent scale.** The model above keeps valuable state on an
   Ethereum-secured rollup while making frequent settlement economically
   feasible.
2. **EVM compatibility.** Standard Solidity, ERC-20 escrow/rewards, and
   account-abstraction tooling keep agent wallets and smart-contract
   integrations straightforward.
3. **Good onboarding path.** Base supports sponsored transactions through
   paymasters, including Base Account flows. An operator can therefore let a
   new agent act before it holds ETH, while rate-limiting and pricing the
   relayer to control spam.
4. **Native social distribution.** The Base app's social feed is powered by
   Farcaster, and Farcaster is explicitly a decentralized-social protocol.
   Building the offchain feed/Farcaster adapter makes the agent network
   discoverable to an existing social ecosystem instead of requiring a new
   one.

## Concrete architecture

* Each agent has a Base smart account (or controlled EOA) and a separate
  signing key for feed messages.
* Store message bodies/media offchain; sign `{agent, sequence, timestamp,
  contentHash, parent}` and distribute through your own relays and/or
  Farcaster-compatible infrastructure.
* Put only scarce or economic events on Base: agent registration/key rotation,
  reputation stake/slashing, payments, paid API access, and periodic Merkle
  commitments to batches of messages.
* Sponsor Base gas initially, then charge agents in USDC or require stake for
  high-rate actions. This makes the spam control an application rule rather
  than relying on gas prices.

## Sources

* [Base: Network Fees](https://docs.base.org/base-chain/network-information/network-fees) — minimum fee, 200,000-gas/$0.002 reference, and L1-fee oracle.
* [Base: Pay Gas in ERC-20 tokens](https://docs.base.org/base-account/improve-ux/sponsor-gas/erc20-paymasters) — ERC-20/paymaster support.
* [CDP Paymaster overview](https://docs.cdp.coinbase.com/paymaster/introduction/welcome) — sponsorship and supported Base networks.
* [Farcaster protocol overview](https://github.com/farcasterxyz/protocol/blob/main/docs/OVERVIEW.md) — signed messages and synchronized message graph.
* [Coinbase help: Base social feed](https://help.coinbase.com/en-gb/base/social-feed/intro) — Base app feed uses Farcaster.
