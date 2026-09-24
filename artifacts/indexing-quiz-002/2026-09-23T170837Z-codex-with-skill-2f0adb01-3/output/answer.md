# Production go-live path for a subgraph on The Graph

Checked on 2026-09-23. The teammate draft is using the old hosted-service mental model, and that is not the production path anymore.

## What the draft gets wrong

The step `graph deploy --hosted-service marketplace` is wrong for a new production launch. The Graph's hosted service has been sunset; The Graph says that as of June 12, 2024 the hosted service is no longer active and queries are powered by The Graph Network. New production subgraphs should go through Subgraph Studio and then be published to the decentralized network.

It is also wrong that production querying is "free" and needs "no tokens, no billing, nothing to set up." Production queries require an API key. Subgraph Studio has a free monthly allowance, but production volume above that allowance is billed. Billing can be paid by credit card or with GRT. If paying with GRT, The Graph's billing system uses GRT on Arbitrum One, and the account needs ETH on Arbitrum for gas.

One more nuance: the Studio deployment endpoint is not the same as the production endpoint. Studio gives you a development/testing query URL after deployment, but The Graph documents that URL as testing-only and rate-limited to 3,000 queries/day. The production endpoint comes after publishing to The Graph Network and looks like:

```text
https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
```

## Correct runbook from "works locally" to production

1. Confirm production compatibility.

   Check that the chain in `subgraph.yaml` is supported on The Graph Network and that the subgraph's features are supported by indexers. This matters because publishing is not enough by itself; indexers must be able and willing to index it.

2. Create the subgraph in Subgraph Studio.

   Use Subgraph Studio with the wallet/team account that should own the subgraph. Record the slug, deploy key owner, and operational access pattern. The Studio deploy key is used by the CLI to deploy versions and manage API keys/billing, so treat it like production infrastructure access.

3. Build and deploy to Studio, not hosted service.

   Typical commands:

   ```bash
   graph codegen
   graph build
   graph auth <DEPLOY_KEY>
   graph deploy <SUBGRAPH_SLUG>
   ```

   Per The Graph's docs, this pushes the subgraph to Studio for testing and metadata work. It does not publish the subgraph to the decentralized network.

4. Test the Studio deployment.

   Use the Studio query URL to run smoke tests and frontend/staging tests, but do not treat it as the production endpoint. It is rate-limited to 3,000 queries/day.

5. Publish to The Graph Network.

   Publish from Studio's Publish button, or with the CLI path:

   ```bash
   graph codegen && graph build
   graph publish
   ```

   Publishing is an onchain action on Arbitrum One for the subgraph registration/ownership path. Budget for Arbitrum gas. The exact gas is variable and should be re-checked from the wallet transaction preview before launch.

6. Add curation signal if this needs production reliability.

   The Graph docs say published subgraphs are unlikely to be picked up by indexers without curation signal, although the Sunrise Upgrade Indexer ensures indexing of all subgraphs. The docs recommend that eligible subgraphs curate their own subgraph with at least 3,000 GRT to attract additional indexers.

   This is not a monthly hosting fee. It is locked GRT signal. The real expense is the curation tax and token/gas friction. On initial curation, a 1% curation tax is incurred and burned. For auto-migrated signal on updates, there is a 0.5% curation tax on migration.

7. Create production API key and billing.

   In Subgraph Studio, create an API key, assign it only to this subgraph, set domain restrictions if it will be used from the frontend, and set a monthly spending limit. The Graph docs say API keys are required, can be limited to domains/subgraphs, and support USD spending limits.

   For a browser dApp, assume the key can be observed. Best production posture is either:

   - backend/API proxy holds the key and the frontend calls your backend; or
   - if querying directly from the frontend, lock the key down with domain restrictions, subgraph allow-listing, and a spend cap.

8. Switch frontend config to the production gateway endpoint.

   Use:

   ```text
   https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
   ```

   Do not use the Studio testing endpoint for production traffic.

9. Monitor after cutover.

   Watch indexing status, sync lag, indexing errors, API key query count, GRT/USD or USD spend, and frontend error rates. For future releases, deploy the new version to Studio, test it, then publish/update the network version. If using auto-migrating curation signal, budget the 0.5% curation tax on updates.

## Budget

### Query billing

Current public pricing I found:

- Free Plan: 100,000 free monthly queries.
- Growth Plan: after the first 100,000 monthly queries, $2 per 100,000 additional queries.
- Payment method: credit card monthly invoice or GRT. If paying with GRT, use GRT on Arbitrum, with ETH on Arbitrum for gas.

Math:

```text
monthly_query_cost = max(queries - 100,000, 0) / 100,000 * $2
```

Examples:

| Monthly queries | Billable queries | Estimated monthly cost |
|---:|---:|---:|
| 1,000,000 | 900,000 | $18 |
| 2,000,000 | 1,900,000 | $38 |
| 3,000,000 | 2,900,000 | $58 |
| 5,000,000 | 4,900,000 | $98 |
| 10,000,000 | 9,900,000 | $198 |

So for "a few million queries/month," I would budget roughly $40-$100/month for query fees at current posted pricing, plus some buffer. If you mean 3 million specifically, budget $58/month before buffer.

Re-check before committing: the $2 per 100,000 queries rate and the 100,000 free monthly allowance are product pricing and can change.

### One-time / launch costs

Publishing:

- Studio deploy/test: no separate fee found in the docs.
- Publish to The Graph Network: onchain transaction, so budget Arbitrum gas. Re-check in wallet at launch time.

Curation signal:

- Recommended signal for eligible production subgraph: at least 3,000 GRT.
- Initial curation tax: 1%, so 30 GRT burned on a 3,000 GRT signal.
- Auto-migration/update tax: 0.5% on auto-migrated curation shares, so 15 GRT on a 3,000 GRT signal each time signal migrates.

Using the live GRT/USD price I found today from CoinMarketCap, $0.027510/GRT:

| Item | GRT | USD at $0.027510/GRT |
|---|---:|---:|
| Recommended signal, locked | 3,000 GRT | about $82.53 |
| Initial 1% curation tax, burned | 30 GRT | about $0.83 |
| 0.5% migration tax on update | 15 GRT | about $0.41 |

Re-check before committing: GRT/USD is volatile, and the recommended signal amount is protocol/product guidance rather than a fixed fee. The 3,000 GRT signal is mostly locked capital, but the tax and gas are actual costs, and the locked GRT has price risk.

### What it costs to "run" month to month

For the normal Subgraph Studio -> The Graph Network -> gateway path, you are not renting a dedicated Graph Node from The Graph. Your recurring bill is query usage above the free tier. Indexing itself is handled by the network/indexers, incentivized by query fees, indexing rewards where eligible, and curation signal.

If the subgraph uses unsupported features, an unsupported chain, or is not reward-eligible, the economics can change. The publishing docs specifically warn that adding signal to a subgraph that is not eligible for rewards will not attract additional indexers. For that case I would not ship until we have confirmed support in The Graph's supported-network/feature matrix or arranged a custom indexing/gateway plan.

## Sources

- Hosted service sunset: The Graph blog says that as of June 12, 2024, the hosted service is no longer active and queries are powered by The Graph Network. https://thegraph.com/blog/sunsetting-hosted-service/
- Deploying with Studio: The Graph docs say `graph deploy <SUBGRAPH_SLUG>` deploys to Studio, does not publish to the decentralized network, and Studio's development query URL is limited to 3,000 queries/day. https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/
- Publishing: The Graph docs describe publishing from Studio or `graph publish`, and say publishing makes the subgraph available for curators and indexers. They also recommend at least 3,000 GRT of self-curation signal for eligible subgraphs. https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/
- Querying from an app: The Graph docs distinguish the testing Studio endpoint from the production network endpoint `https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>`. https://thegraph.com/docs/en/subgraphs/querying/from-an-application/
- Billing and plans: The Graph Subgraph Studio docs list 100,000 free monthly queries, Growth Plan billing beyond that, credit-card/GRT payment, GRT on Arbitrum, and ETH on Arbitrum for gas. https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/
- Current posted query price: The Graph Studio billing page says Growth Plan charges $2 per 100,000 queries after the first 100,000 free queries/month. https://thegraph.com/studio/billing/upgrade/
- API key controls: The Graph docs say API keys are required, support subgraph/domain restrictions, usage monitoring, and USD spending limits. They also warn not to hardcode or expose API keys in client-side apps. https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/
- Curation taxes: The Graph curating docs list the 1% curation tax, 0.5% migration tax, and 10% curator share of query fees. https://thegraph.com/docs/en/resources/roles/curating/
- GRT/USD price used for the example conversion: CoinMarketCap showed live GRT price of $0.027510 USD when checked on 2026-09-23. https://coinmarketcap.com/currencies/the-graph/
