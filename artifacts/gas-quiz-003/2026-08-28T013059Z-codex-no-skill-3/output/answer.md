# Deploy the execution layer on Base (chain ID 8453)

Use **Base** for agent identities, staking/bonds, payments, reputation checkpoints, and any other state that must be independently verifiable. Keep the actual feed payloads, embeddings, and model outputs off-chain in a signed, replicated message store; put their content hash, author, timestamp, and optional economic action on Base. That is the right split for a high-frequency social product--not “put every post in contract storage.”

## Why Base

1. **It is Ethereum security and tooling at a social-product price.** Base is an OP Stack optimistic rollup that publishes to Ethereum and uses ETH for gas. It is listed by L2BEAT as a Stage 1 rollup, with $12.75B total value secured (snapshot accessed 2026-08-27). This preserves EVM/Solidity, Ethereum accounts, stablecoins, and Ethereum settlement without making every agent action an L1 transaction.
2. **It has headroom for an agent feed.** L2BEAT reports 11.70M operations in the preceding day: 135.47 UOPS on average and 244.48 UOPS at the observed maximum. A launch target of 1,000,000 on-chain actions/day is only 11.57 actions/s, or **8.5%** of that current average throughput (and 4.7% of the reported peak). This is a more relevant test than comparing headline TPS.
3. **The distribution fit is unusually strong.** Farcaster is an Ethereum social protocol; its developer docs support building mini-apps in its feed, signing in with Farcaster, and querying real-time social data. Coinbase says its Base App social feed is powered by Farcaster and shared across that ecosystem. Base therefore gives a credible route to reach an existing Ethereum-social audience, while the app remains a normal EVM application rather than depending on a proprietary social chain.

## Cost model and numbers

I use one conservative planning unit: **one contract call per agent action** (post commitment, reaction, follow, tip, or moderation bond), at 200,000 gas. Actual calls must be gas-profiled before launch; large text must never be stored on-chain.

| Input | Value | Calculation / source |
|---|---:|---|
| Base minimum L2 fee | 0.005 gwei | Base configuration |
| Planning call gas | 200,000 | conservative application-call assumption |
| ETH price for the illustrative calculation | $2,000 | the price in Base's own fee example |
| Execution-only floor | $0.002/action | 200,000 × 0.005e-9 ETH/gas × $2,000/ETH |
| Historical all-in Base average | $0.0146/transaction | Token Terminal figure as of Jan. 2026, reported in the cited study; use this, not the floor, for budgeting |
| Launch volume | 1,000,000 actions/day | product planning assumption |
| Base monthly transaction spend | **$438,000/month** | 1,000,000 × 30 × $0.0146 |
| Mainnet gas-price scenario | 20 gwei | explicit planning assumption, not a live quote |
| Mainnet illustrative spend | **$240M/month** | 1,000,000 × 30 × (200,000 × 20e-9 ETH/gas × $2,000/ETH = $8/action) |
| Savings versus that mainnet case | **$239.56M/month (99.82%)** | ($240M − $0.438M) / $240M |

The $0.002 is deliberately labeled an **L2 execution floor**, not a promised total. Base charges both L2 execution and an L1 data-publication/security component, normally the larger component. Budget from an observed all-in fee and set per-action fee caps using Base's `getL1Fee`/`getL1FeeUpperBound`; adjust the $438k estimate with live quotes before committing spend. At the same $2,000 ETH reference, the execution floor alone would be $60,000/month, so the budgeting range is $60k--$438k/month before traffic and calldata variability.

## Trade-off and implementation guardrails

Base is not Ethereum L1: L2BEAT attributes **38.2%** of its secured value to additional trust assumptions, so do not use it as the only final settlement layer for a treasury or irrecoverable, very high-value collateral. Put a timelocked Ethereum-mainnet escape/settlement contract around those assets, and treat Base as the fast operating layer.

For the feed itself, require each agent event to be signed by its owner/delegated key, replicate signed events off-chain, and periodically batch a Merkle root to Base. This makes a 1M-event/day feed feasible: most events incur no gas, while the moments that need payments, anti-spam bonds, ownership, or dispute resolution remain composable and auditable on Ethereum infrastructure.

## Sources (accessed 2026-08-27)

- [L2BEAT: Base Chain](https://l2beat.com/layer2s/projects/base?selectedChart=detailedTvl) — Stage 1, $12.75B TVS, UOPS/operation counts, chain ID, and additional-trust-assumption share.
- [Base Network Fees documentation](https://docs.base.org/base-chain/network-information/network-fees) — 0.005 gwei floor, fee composition, and L1-fee estimation methods.
- [Base scaling and block-time metrics](https://blog.base.dev/scaling-base-in-2025) — 2-second blocks.
- [Farcaster developer documentation](https://docs.farcaster.xyz/) and [Coinbase Base App social-feed documentation](https://help.coinbase.com/en-gb/base/social-feed/intro) — social/mini-app distribution fit.
- [Transaction-cost study](https://www.hbs.edu/ris/Publication%20Files/Du_Huang_Scharfstein_14Feb2016_66992079-2e6b-4584-95cf-014441c77485.pdf) — $0.0146 Base three-year average shown as of Jan. 2026 (the planning, not live-quote, fee input).
