# Production runbook: The Graph subgraph

## Bottom line

The draft describes a product that no longer exists. The Graph's Hosted Service has been inactive since **June 12, 2024**. `graph deploy --hosted-service marketplace` is not today's production path. The current path is:

1. deploy privately to **Subgraph Studio** for staging;
2. publish the tested deployment onchain to **The Graph Network**;
3. wait for it to sync and verify healthy indexers;
4. create and restrict an **API key**;
5. put the network gateway URL containing that key into the frontend;
6. enable billing and monitor usage/health.

Sources: The Graph's [Hosted Service sunset notice](https://thegraph.com/blog/sunsetting-hosted-service/) says it has been inactive since June 12, 2024. Its [Studio deployment guide](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/) explicitly distinguishes deploying to Studio from publishing to the decentralized network.

## What the draft gets wrong

- **Wrong destination and command.** Hosted Service is gone. `--hosted-service` is legacy. Studio deployment currently uses `graph deploy <SUBGRAPH_SLUG>` after Studio authentication.
- **Deploy is not production publication.** A Studio deployment is private staging. It provides a development query URL, but that URL is limited to **3,000 queries/day** and is not the production endpoint. Publishing is a separate onchain action that makes the subgraph available to network Indexers. Source: [Studio deployment guide](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/).
- **Production queries require an API key.** A published subgraph's gateway URL includes the consumer's key. Source: [querying guide](https://thegraph.com/docs/en/subgraphs/querying/introduction/) and [transfer guide example](https://thegraph.com/docs/en/subgraphs/guides/transfer-to-the-graph/).
- **Production usage is not unconditionally free.** The first 100,000 queries/account/month are free; usage above that is billed. Source: [official Studio pricing](https://thegraph.com/studio-pricing/).
- **Publishing and curation involve a wallet/tokens.** Protocol actions occur on Arbitrum One and cost gas; GRT signal is how a subgraph attracts more Indexers. This is separate from paying query invoices by card or GRT.

## Concrete go-live sequence

### 1. Production-readiness checks

- Confirm the target chain is supported by the decentralized network and every manifest feature is supported/eligible for indexing rewards. The [supported-networks table](https://thegraph.com/docs/en/supported-networks/) is the source of truth. If the chain is unsupported, the managed-network path below may not work; self-hosting Graph Node (and its RPC/database/ops bill) is a different budget.
- Pin a current `@graphprotocol/graph-cli`; run `graph codegen`, `graph build`, and existing mapping tests.
- Check production contract addresses, network identifier, deployment block/start block, data-source templates, and IPFS dependencies. A wrong start block can greatly extend initial sync.

### 2. Stage in Subgraph Studio

1. Create the subgraph in [Subgraph Studio](https://thegraph.com/studio/) and connect the team's owner wallet (prefer a controlled team/multisig ownership arrangement).
2. Retrieve the Studio deploy key and authenticate: `graph auth <DEPLOY_KEY>`.
3. Deploy with a meaningful version label: `graph deploy <SUBGRAPH_SLUG>`.
4. In Studio, wait for indexing; inspect `health`, fatal/non-fatal errors, latest indexed block versus chain head, and run production-shaped GraphQL queries through the development URL.

Studio staging is free, but the development endpoint is capped at **3,000 queries/day**. Source: [Studio deployment guide](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/). Do not use that URL as the production frontend backend.

### 3. Publish to The Graph Network

- From Studio, select **Publish**, connect the owner wallet, confirm metadata/version, and sign the Arbitrum One transaction. Alternatively, current Graph CLI supports `graph publish` after `graph codegen && graph build` and opens a wallet UI. Source: [publishing guide](https://thegraph.com/docs/en/subgraphs/developing/publishing/publishing-a-subgraph/).
- Publication registers the subgraph onchain and exposes it in Graph Explorer so Indexers can index it. It therefore incurs **variable Arbitrum One gas in ETH**. The docs do not promise a fixed publication fee; re-check the wallet's transaction estimate immediately before budgeting/releasing.
- Wait until the network deployment has caught up. In Graph Explorer verify health, indexed block, and which Indexers serve it. Exercise the exact production query URL before switching traffic.

### 4. Decide how much reliability signal to provide

The Sunrise Upgrade Indexer ensures all published subgraphs are indexed, so GRT signal is not described as a hard minimum. But The Graph recommends **at least 3,000 GRT** of self-curation for an indexing-reward-eligible subgraph to attract additional Indexers, improving latency and availability. Source: [publishing guide, “Adding signal”](https://thegraph.com/docs/en/subgraphs/developing/publishing/publishing-a-subgraph/).

Treat the 3,000 GRT as **locked working capital, not a monthly hosting fee**. It remains exposed to GRT/USD price movement. Signaling incurs a **1% curation tax** (30 GRT on 3,000 GRT), and withdrawing also incurs a stated **1% curation tax**; auto-migrating signal to a new version incurs **0.5%**. It also requires Arbitrum gas. Source: The Graph's [curation documentation](https://thegraph.com/docs/en/resources/roles/curating/).

Re-check all four items immediately before approval: the 3,000-GRT recommendation, GRT/USD price, tax rules, and Arbitrum gas. They are protocol/market-dependent. Also verify the subgraph is indexing-reward eligible: the publishing docs warn that signaling an ineligible subgraph will not attract more Indexers.

### 5. Create the production query credential and endpoint

1. In Studio, create a production API key.
2. Restrict it to this subgraph and the production web origins/domains; optionally restrict allowed Indexers. Use separate staging and production keys. Source: [Studio deployment guide](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/).
3. Obtain the published subgraph's ID/query URL from Graph Explorer. It has this shape:

   `https://gateway-arbitrum.network.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>`

4. Configure the frontend, deploy, and smoke-test. A browser-delivered key cannot be a true secret because it appears in requests. Domain/subgraph restrictions limit abuse. If stronger secrecy, quotas, caching, or instant key rotation are required, call The Graph through your own backend/edge proxy instead; budget that infrastructure separately.

5. Monitor API-key usage, invoices, sync lag, indexing errors, Indexer count, latency, and error rate. Keep rollback/version procedures. Deploying an update to Studio is again staging; publishing the new version is an onchain update. Auto-migrated signal may incur the **0.5%** migration tax cited above.

## Budget

### Stand-up / release cost

| Item | Budget treatment | Source |
|---|---:|---|
| Studio create/deploy/test | **$0** under current product terms | [Studio pricing](https://thegraph.com/studio-pricing/) says unlimited creation/testing; [deployment docs](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/) describe staging |
| Publish transaction | Variable **Arbitrum ETH gas** | [Publishing docs](https://thegraph.com/docs/en/subgraphs/developing/publishing/publishing-a-subgraph/) identify publication as an Arbitrum onchain action |
| Recommended reliability signal | **3,000 GRT locked**, optional/recommended rather than consumed hosting spend | Same [publishing docs](https://thegraph.com/docs/en/subgraphs/developing/publishing/publishing-a-subgraph/) |
| Initial signal tax | **1% = 30 GRT** burned on 3,000 GRT, plus gas | [Curation docs](https://thegraph.com/docs/en/resources/roles/curating/) |
| Future version migration | **0.5% of auto-migrated signal**, plus gas | [Curation docs](https://thegraph.com/docs/en/resources/roles/curating/) |

Do not put a fixed USD amount against the gas or 3,000 GRT here. On procurement day calculate `3,000 × live GRT/USD`, separately show the 30-GRT initial tax, and use the wallet's live Arbitrum gas quote. Locked signal is treasury capital at risk; only tax/gas is immediately consumed.

### Monthly query cost

Current list price: **100,000 queries/month free, then $2 per additional 100,000 queries**. Source: [official Studio pricing](https://thegraph.com/studio-pricing/), viewed August 12, 2026. Assuming billing is linear and “queries” means billable gateway queries recorded to the account:

| Monthly queries | Calculation | Estimated monthly query bill |
|---:|---:|---:|
| 2,000,000 | (2.0m - 0.1m) / 0.1m × $2 | **$38** |
| 3,000,000 | (3.0m - 0.1m) / 0.1m × $2 | **$58** |
| 5,000,000 | (5.0m - 0.1m) / 0.1m × $2 | **$98** |

Thus a reasonable placeholder for “a few million” is roughly **$38–$98/month**, with **$58/month at 3 million**. Re-check the pricing page and Studio's billing estimator immediately before committing the budget: this is a current vendor price, not a protocol constant, and taxes/card terms may differ by jurisdiction.

Beyond the free allowance, enable the Growth Plan and choose:

- **Credit card:** monthly invoice to the active card. No GRT balance is needed for query payment.
- **GRT:** fund the billing balance with GRT; billing settles monthly. The billing system uses **GRT on Arbitrum**, and depositing/withdrawing requires **ETH on Arbitrum for gas**. The approval itself is documented as gas-free, while adding the billing balance costs gas. Unused balance can be withdrawn. Source: [billing documentation](https://thegraph.com/docs/en/subgraphs/billing/).

Query-payment GRT and curation-signal GRT are different pots and purposes: query GRT is spent against invoices; signaled GRT is locked to attract Indexers and is subject to curation taxes. Card billing avoids holding GRT for queries, but it does not remove the wallet/gas requirements for publishing or any decision to curate.

## Reasoning behind the recommendation

The production dependency is not “a free hosted GraphQL server.” It is a staged artifact published into a decentralized indexing market, queried through an authenticated, metered gateway. Therefore the runbook must gate traffic on successful network sync and observable Indexer service, while the budget must separate (1) small variable release gas, (2) optional but operationally meaningful GRT capital plus taxes, and (3) predictable usage billing. For a frontend at roughly 3 million queries/month, I would budget the current **$58/month list-price query charge**, a contingency for an edge proxy/monitoring if used, and separately seek treasury approval for **3,000 GRT signal plus 30 GRT initial tax and Arbitrum gas**—all re-priced on the approval date.
