# Production runbook: The Graph subgraph

## Bottom line

The draft is obsolete. The Hosted Service stopped operating on **June 12, 2024**, so `graph deploy --hosted-service marketplace` is not today's production path. The replacement is:

1. deploy a version to **Subgraph Studio** for staging;
2. publish that version, via an Arbitrum wallet transaction, to **The Graph Network**;
3. let network indexers sync it and verify it is healthy;
4. create and restrict an API key, enable billing, and put the Network gateway URL in the frontend.

At today's published retail price, the first **100,000 queries/account/month are free**, then usage is **$2 per 100,000 queries**. Thus 2M queries/month is about **$38/month**, 3M about **$58/month**, and 5M about **$98/month**, before any taxes/card effects. These are arithmetic estimates from The Graph's current price page, not contractual quotes; re-check the price, free allowance, and what counts as a query immediately before budgeting.

## What the draft gets wrong

- **There is no Hosted Service to deploy to.** The Graph says it is no longer active and all queries are now powered by The Graph Network. [The Graph, Hosted Service sunset](https://thegraph.com/blog/sunsetting-hosted-service/)
- **Studio deploy is staging, not production publication.** `graph deploy <SUBGRAPH_SLUG>` pushes a private version to Studio. The development URL is limited to **3,000 queries/day** and should not be the production frontend URL. [The Graph, deploying with Studio](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/)
- **Production publication is an onchain operation.** It registers the subgraph on the decentralized network so indexers can index and serve it. [The Graph, publishing](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/)
- **The production query URL needs an API key.** It is neither “no tokens” nor “nothing to set up”: requests use a Studio API key; paid usage needs a Growth plan funded by card or GRT. [The Graph, querying](https://thegraph.com/docs/en/subgraphs/querying/introduction/)

## Concrete go-live sequence

### 1. Production-readiness checks

- Confirm the manifest's chain name, production contract address, ABI, and `startBlock`.
- Confirm that chain and all subgraph features are supported on The Graph Network. Local Graph Node success alone does not prove Network compatibility.
- Run `graph codegen`, tests, and `graph build`; pin the Graph CLI and dependencies in the runbook.

### 2. Create the Studio subgraph and stage a version

- Connect the team-controlled wallet (preferably the appropriate multisig/ownership arrangement) to Subgraph Studio and create `marketplace`.
- Copy the Studio deploy key and authenticate: `graph auth <DEPLOY_KEY>`.
- Deploy: `graph deploy <SUBGRAPH_SLUG>` and give the build a semantic version label.
- In Studio, wait for the deployment to sync to the chain head. Inspect indexing errors/logs and rerun representative GraphQL queries against the development endpoint. Do not cut the frontend over to it: that URL has the documented 3,000-query/day limit. Source: [Studio deployment guide](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/).

Treat the deploy key as a secret. It is for deployment/management, not browser code.

### 3. Publish to the decentralized network

- From Studio, click **Publish**, review metadata, connect the wallet on **Arbitrum One**, and approve the transaction. Alternatively, current Graph CLI supports `graph codegen && graph build` followed by `graph publish`, which opens the wallet publication flow.
- Publication makes the subgraph visible in Graph Explorer and available for indexers to begin indexing. Publishing does not mean it is immediately fully synced.
- Wait for at least one serving indexer and full sync; verify Graph Explorer health, latest indexed block, query correctness, latency, and `_meta { hasIndexingErrors block { number } }` before changing production configuration.

Source: [The Graph publication guide](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/).

### 4. Decide whether to add curation signal

The Sunrise Upgrade Indexer ensures all published subgraphs are indexed, so signal is not presented as a mandatory hosting fee. But The Graph recommends **at least 3,000 GRT** of self-signal for an indexing-reward-eligible subgraph to attract more indexers and improve availability/latency. This is economically material:

- 3,000 GRT is locked capital in curation shares, not a monthly charge;
- initial signaling incurs a **1% curation tax**: at exactly 3,000 GRT, about **30 GRT is burned**, plus Arbitrum gas;
- an auto-migration to a new version incurs a **0.5% curation tax** on auto-migrated shares, plus gas;
- GRT's fiat value moves, so price the 3,000 GRT and 30 GRT in USD on budget day.

The 3,000-GRT recommendation comes from [The Graph publication guide](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/); the 1%/0.5% taxes and withdrawal details come from [The Graph curation docs](https://thegraph.com/docs/en/resources/roles/curating/). **Re-check all three figures before committing budget:** protocol governance and documentation can change, and the precise publish UI may require or suggest a different amount.

### 5. Configure production querying and billing

- In Studio, create a separate production API key. Restrict it to this subgraph and the frontend's allowed domains. A browser key cannot be kept secret, so restrictions, usage alerts, and rotation are essential; use a backend proxy if stronger abuse control is required.
- Take the published subgraph's Network query URL from Graph Explorer and replace its `<api_key>` placeholder with that key. Use this gateway URL—not the Studio development URL—in production.
- The Free plan covers 100,000 queries/month. Before exceeding it, upgrade to Growth and choose:
  - **credit card:** invoices at month end for overage; no GRT acquisition is necessary;
  - **GRT:** fund the billing balance with GRT. Billing settles on **Arbitrum One** and adding/withdrawing funds requires **ETH on Arbitrum for gas**. Approval itself is documented as gasless; depositing is not.
- Add spend/usage monitoring, rate limiting or a proxy where appropriate, and alerts for indexing errors, lag, query failures, and depleted billing balance. Keep the last good frontend endpoint/configuration available for rollback while a new version syncs.

Sources: [query/API-key requirements](https://thegraph.com/docs/en/subgraphs/querying/introduction/) and [Studio billing mechanics](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/).

## Budget calculation

The current public price is **$2 per 100,000 queries after the first 100,000 free each month**. [The Graph Studio pricing, retrieved 2026-08-12](https://thegraph.com/studio-pricing/)

Reasoning:

`monthly query charge = max(queries - 100,000, 0) / 100,000 × $2`

| Monthly queries | Paid queries | Estimated query bill |
| ---: | ---: | ---: |
| 100,000 | 0 | $0 |
| 1,000,000 | 900,000 | $18 |
| 2,000,000 | 1,900,000 | $38 |
| 3,000,000 | 2,900,000 | $58 |
| 5,000,000 | 4,900,000 | $98 |

This assumes the displayed linear price applies to every request and the allowance is account-wide as stated. It excludes card taxes/FX and abuse traffic. **Re-check the pricing page and Studio estimator before approval**, then budget headroom because every frontend refresh may make several GraphQL requests and an exposed key can be abused.

### Stand-up costs

| Item | Required? | Budget treatment |
| --- | --- | --- |
| Studio staging deploy | Yes | Documented as free; development URL limited to 3,000 queries/day. |
| Publish transaction on Arbitrum One | Yes | Variable Arbitrum gas in ETH; quote from the wallet immediately before publishing. No durable USD figure. |
| Production queries | Yes | First 100K/month free; then current published price above. |
| Self-signal | Not strictly required by current guide; recommended for stronger indexer participation | Recommended 3,000 GRT locked; 1% initial tax (~30 GRT) plus gas. Re-price GRT and confirm protocol terms. |
| Future published versions | Operationally likely | Arbitrum gas; if signal auto-migrates, documented 0.5% curation tax on migrated signal. |
| GRT billing deposit | Only if paying in GRT | GRT working balance plus Arbitrum ETH gas. Card billing avoids token handling for query fees. |

Therefore a minimal launch can have no fixed hosting/setup fee beyond small, variable Arbitrum publication gas, followed by usage billing. A resilience-oriented launch should separately budget the recommended curation signal as locked treasury capital and its nonrecoverable tax; do not describe that as “free hosting.”
