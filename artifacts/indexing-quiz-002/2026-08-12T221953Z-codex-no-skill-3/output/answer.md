# Production runbook: The Graph

Checked 2026-08-12. The draft is obsolete. The Hosted Service stopped accepting deployments and its query endpoints stopped working on **June 12, 2024**; production is now The Graph Network, not `graph deploy --hosted-service ...`. ([The Graph sunset notice](https://thegraph.com/blog/sunsetting-hosted-service/))

## From local to production

1. **Confirm network compatibility.** Check that the chain and every feature used by `subgraph.yaml` are supported by the decentralized network. A locally working Graph Node is not proof of network compatibility. The official [supported-networks page](https://thegraph.com/docs/en/supported-networks/) is the release gate; if the chain is unsupported, the alternative is operating Graph Node and its RPC/database infrastructure ourselves, whose cost is outside The Graph's managed query pricing.

2. **Create the Studio subgraph and deployment identity.** In [Subgraph Studio](https://thegraph.com/studio/), connect the team's wallet, create `marketplace`, and record its slug and deploy key. Prefer a team-controlled multisig for eventual ownership: publishing mints an ERC-721-like subgraph NFT and its owner controls updates. ([ownership docs](https://thegraph.com/docs/en/subgraphs/developing/managing/transferring-a-subgraph/))

3. **Authenticate, build, and deploy a candidate to Studio.** With a current `@graphprotocol/graph-cli`, run roughly:

   ```sh
   graph auth <DEPLOY_KEY>
   graph codegen
   graph build
   graph deploy <SUBGRAPH_SLUG>   # current docs also show --studio in some flows
   ```

   Supply a meaningful semver label. This uploads a private candidate to Studio; **deploying is not publishing**. The deploy key is a secret and should live in CI secrets. The exact current commands and the three-unpublished-subgraph limit are in the official [Studio deployment guide](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/).

4. **Treat the Studio URL as staging only.** Wait for the candidate to catch up, inspect health/errors and block head, and rerun representative and load-sensitive queries against `https://api.studio.thegraph.com/query/<ID>/<NAME>/<VERSION>`. This endpoint is rate-limited and not the production contract; the deployment guide currently states **3,000 queries/day**. Validate the production contract address, start block, network name, data completeness, reorg behavior, and query latency before promotion. ([Studio deployment guide](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/), [application-query guide](https://thegraph.com/docs/en/subgraphs/querying/from-an-application/))

5. **Publish onchain to The Graph Network.** Use Studio's **Publish** action (or the documented `graph publish` flow), select Arbitrum One for production, review the wallet transaction, and publish the tested deployment. This registers the subgraph onchain/Graph Explorer so Indexers can serve it; it is distinct from the preceding upload. Publishing therefore requires a wallet and **Arbitrum ETH for gas**. Gas is variable, so obtain a live wallet quote at release time rather than budgeting a fixed dollar number. ([publishing guide](https://thegraph.com/docs/es/subgraphs/developing/publishing/publishing-a-subgraph/))

6. **Ensure indexing capacity.** Wait until the published version is indexed and synced before cutover. The Sunrise Upgrade Indexer provides baseline indexing, but curation signal attracts additional independent Indexers. The Graph's guide recommends **about 3,000 GRT to attract about three Indexers**; this is guidance, not a mandatory hosting fee or guarantee. Signal is locked capital, not monthly spend, but initial signaling burns a **1% curation tax** (about 30 GRT on 3,000 GRT) plus Arbitrum gas; auto-migrating signal loses **0.5% on each version migration**. Both the GRT amount and its USD value must be re-checked at launch. Sources: [transfer guide (3,000 GRT)](https://thegraph.com/docs/en/subgraphs/guides/transfer-to-the-graph/) and [curation docs (taxes/risks)](https://thegraph.com/docs/en/resources/roles/curating/).

7. **Create and fund production query access.** Create a separate production API key in Studio, restrict it to this subgraph and the frontend's allowed domains, set a spending limit, and select the Growth plan with either a card or GRT. With GRT, keep enough **GRT on Arbitrum** in the billing balance; invoices settle monthly. With a card, no GRT is needed for queries. A key is required for normal gateway queries—so “no tokens, no billing, nothing to set up” is false even if usage stays inside the free allowance. ([billing docs](https://thegraph.com/docs/en/subgraphs/billing/), [API-key guide](https://thegraph.com/docs/ar/subgraphs/querying/managing-api-keys/))

8. **Cut over deliberately.** Configure the frontend for `https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>` (or use bearer auth). For safer releases, point production at the immutable **deployment ID** and change it only after the replacement is synced; the stable subgraph ID follows versions automatically but can temporarily serve an older version while a new one syncs. Keep the old deployment available for rollback, smoke-test through the actual gateway, and monitor indexing lag, errors, gateway latency, query counts, cost, and spend-limit failures. ([endpoint guide](https://thegraph.com/docs/en/subgraphs/querying/from-an-application/), [ID tradeoffs](https://thegraph.com/docs/en/subgraphs/querying/subgraph-id-vs-deployment-id/))

## Budget

There is no recurring charge merely for having the published subgraph indexed under the managed Network flow. The costs are:

- **One-time/on-update:** Arbitrum gas for publish/update transactions: variable; quote immediately before execution. Optional reliability signal: roughly 3,000 GRT locked; 1% (roughly 30 GRT) burned initially, plus gas. Future auto-migrations burn 0.5% of migrated signal. Re-check GRT/USD and the recommendation/tax before approval.
- **Queries:** **100,000 queries/account/month free**, then Growth-plan usage is billed to card or in GRT. Official billing docs confirm the allowance and payment methods but the current documentation page does not expose a fixed unit price; Studio's live estimator is therefore the authoritative quote to capture on budget day. ([billing docs](https://thegraph.com/docs/en/subgraphs/billing/))
- **Planning estimate only:** The Graph's April/May 2024 published update states **$40 per 1 million queries above the first 100,000**. At that rate: 2M total/month = 1.9M billable = **$76/month**; 3M = 2.9M = **$116/month**; 5M = 4.9M = **$196/month** (before any taxes/card effects). Source: [Edge & Node update](https://forum.thegraph.com/t/edge-node-s-april-may-update/5747). **Re-check every one of these numbers in Studio immediately before committing the budget:** the numeric source is from 2024, while current official billing docs deliberately describe usage pricing without promising that rate.

“Query” means a gateway request, not a page view; retries, polling, bots, multiple widgets, and cache misses all count. Forecast from measured request volume, include headroom, domain/subgraph restrictions and a spend cap, and decide how the UI degrades when the cap is reached. The API key is not a private secret when embedded in a browser; restrictions and caps are the control. The official FAQ explicitly recommends a frontend key restricted by hostname and subgraph. ([developer FAQ](https://thegraph.com/docs/en/subgraphs/developing/developer-faq/))

Finally, GRT is involved in two separate ways that should not be conflated: **optional curation signal** to encourage redundancy (locked GRT plus taxes), and **query payment** (GRT consumed by invoices, unless paying by card). Neither requires the team to operate an Indexer. An API-key-less x402/USDC route exists, but The Graph recommends the API-key flow for sustained high-volume applications, so it is not the default production plan here. ([x402 docs](https://thegraph.com/docs/en/subgraphs/tooling/x402-payments/))
