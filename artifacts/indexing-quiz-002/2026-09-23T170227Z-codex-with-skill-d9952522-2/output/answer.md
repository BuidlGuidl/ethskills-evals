# Production go-live path for our marketplace subgraph

Checked on 2026-09-23.

The draft runbook is materially wrong. `graph deploy --hosted-service marketplace` is the old hosted-service mental model. The hosted service is no longer the production path: The Graph says the hosted service became inactive on 2024-06-12 and queries are now powered by The Graph Network. Current `graph-cli` releases also removed the hosted-service/studio product flags from `graph auth`, `graph deploy`, and `graph init` as part of the hosted-service sunset.

The production path today is:

1. Deploy the subgraph build to Subgraph Studio.
2. Test/sync it there.
3. Publish it from Studio or the CLI to The Graph Network.
4. Create and secure a Studio API key.
5. Set up billing for production query volume.
6. Point the app at the gateway query URL, with monitoring and spending limits.

## What the draft gets wrong

- There is no free hosted-service go-live step anymore. The old hosted service is inactive; new production traffic should be on The Graph Network.
- `graph deploy` alone is not the same as publishing. The docs say `graph deploy <SUBGRAPH_SLUG>` pushes to Subgraph Studio for testing and metadata updates, and "won't publish your Subgraph to the decentralized network."
- A production query URL requires an API key. The Graph docs say each Network query URL requires a valid API key.
- "No billing" is wrong above hobby scale. The current Studio free plan includes 100,000 queries/month. After that, production usage needs the Growth plan and is paid by credit card or GRT.
- "Frontend can hit it straight away" needs care. The endpoint exists after publish and indexing, but The Graph's API key docs say not to hardcode or expose API keys in client-side apps. If we query directly from a browser, we should at least restrict the API key by domain and subgraph and set a monthly spend limit; a backend/proxy is cleaner for protecting the key.

## Correct runbook

### 1. Confirm production eligibility

- Confirm the marketplace chain is supported by The Graph Network.
- Confirm the subgraph is deterministic and fully synced locally.
- Run the existing local checks again before publish:

```bash
graph codegen
graph build
graph test
```

### 2. Create or select the Subgraph Studio project

- Open Subgraph Studio.
- Connect the team's deploy/publishing wallet. Use a team-controlled wallet or Safe, not a personal wallet.
- Create or select the marketplace subgraph slug.
- Copy the Studio deploy key.

### 3. Authenticate and deploy to Studio

```bash
graph auth <DEPLOY_KEY>
graph deploy <SUBGRAPH_SLUG>
```

Use a real version label, for example `1.0.0`.

This deploy is the pre-production Studio deployment. It is useful for testing, logs, and validation, but it is not the production Network publish. The Studio development query URL is also capped at 3,000 queries/day, so it is not the frontend production endpoint.

### 4. Test the Studio deployment

- Wait for indexing to catch up.
- Check Studio logs for deterministic failures, handler errors, missing ABIs, reverted calls, and chain/RPC issues.
- Run the same GraphQL queries the frontend uses.
- Record the deployed version label and resulting deployment/subgraph ID.

### 5. Publish to The Graph Network

Publish from Studio with the Publish button, or use the CLI publish flow:

```bash
graph codegen
graph build
graph publish
```

Publishing is an onchain action. Published subgraphs are published on Arbitrum One even if the indexed data is from another supported chain. Once published, the subgraph becomes visible in Graph Explorer so Curators can signal on it and Indexers can index it.

Budget impact:

- Mandatory: Arbitrum gas for the publish transaction. This is variable and should be rechecked at publish time.
- Optional/recommended for reliability: curation signal in GRT. The docs recommend eligible subgraphs self-curate with at least 3,000 GRT to attract additional Indexers. The Sunrise Upgrade Indexer indexes all subgraphs, but signal helps attract more Indexers and can improve latency/availability.
- Curation tax: initial curation incurs a 1% tax. On a 3,000 GRT signal, that is 30 GRT burned, plus gas. If signal is auto-migrated to a later version, the docs describe a 0.5% curation tax on migration, so frequent version publishes have a real token cost.

At the GRT spot prices I saw on 2026-09-23, 3,000 GRT is roughly USD 80-83 and the 30 GRT initial curation tax is roughly USD 0.80-0.83. This USD conversion is highly volatile and should be rechecked immediately before budgeting or buying tokens. If we do not self-curate, the required GRT working capital can be zero, but we may get fewer independent Indexers serving the subgraph.

### 6. Create API key and billing

In Subgraph Studio:

- Create a production API key.
- Restrict it to the production subgraph.
- Add allowed domains if the browser will call the gateway directly.
- Set a monthly spending limit in USD.
- Upgrade to the Growth plan before launch if expected traffic exceeds 100,000 queries/month.
- Choose payment method:
  - Credit card: no GRT needed for query bills.
  - GRT: requires GRT on Arbitrum and ETH on Arbitrum for gas; invoices are paid from the GRT billing balance.

Production query URL shape:

```text
https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
```

The docs also show bearer-token auth:

```text
Authorization: Bearer <API_KEY>
```

Do not commit the API key to the repo. If the frontend is fully static and must call The Graph directly, treat the key as abuse-controllable rather than secret: restrict domain/subgraph access and set a monthly spend limit. For stricter control, route frontend GraphQL calls through our backend or edge proxy.

### 7. Cut over frontend traffic

- Add production environment variables for `SUBGRAPH_ID` and the gateway URL/API key.
- Deploy a canary frontend or feature-flagged endpoint switch.
- Compare several key marketplace views against local/Staging Graph Node results.
- Watch Studio/API-key usage, errors, query volume, and spend during the first day.
- Keep the old local/staging deployment for debugging, not as production fallback.

## Cost reasoning

The query price I found in the live Studio billing page is:

- First 100,000 queries/month: free.
- Then USD 2 per additional 100,000 queries.

Formula:

```text
monthly_query_cost = max(0, monthly_queries - 100,000) / 100,000 * $2
```

Examples:

| Monthly queries | Billable queries | Estimated monthly query bill |
| ---: | ---: | ---: |
| 100,000 | 0 | $0 |
| 500,000 | 400,000 | $8 |
| 1,000,000 | 900,000 | $18 |
| 2,000,000 | 1,900,000 | $38 |
| 3,000,000 | 2,900,000 | $58 |
| 5,000,000 | 4,900,000 | $98 |

For "a few million queries/month," I would budget roughly USD 40-100/month for query fees, depending whether "few" means 2-5 million, plus a little headroom for spikes. I would recheck the $2/100k rate before committing the budget because it is product pricing and can change.

Stand-up budget:

- Deploy to Studio: $0.
- Studio test endpoint: $0, but limited to 3,000 queries/day.
- Publish transaction: variable Arbitrum gas; recheck at publish time.
- Query billing setup: no up-front charge if using credit card, but usage beyond 100,000/month is billed.
- Optional curation working capital: recommended 3,000 GRT for eligible subgraphs. This is not a monthly hosting fee, but it ties up GRT and incurs curation tax/gas. At the 2026-09-23 spot prices I found, that is roughly USD 80-83 of GRT, with about USD 0.80-0.83 burned as the 1% curation tax. Recheck GRT price before budgeting.
- Ongoing monthly query bill at 3,000,000 queries/month: about $58/month at the current Studio price.

## Sources to re-check

- Hosted service inactive as of 2024-06-12 and Network queries now used: https://thegraph.com/blog/sunsetting-hosted-service/
- Current Studio deploy flow; `graph auth <DEPLOY_KEY>`; `graph deploy <SUBGRAPH_SLUG>` deploys to Studio but does not publish; development URL limit of 3,000 queries/day; publish/version notes and publish costs: https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/
- Publishing to the decentralized network, `graph publish`, Arbitrum One publication, and recommended 3,000 GRT signal: https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/
- Querying a published subgraph requires an API key; free plan is 100,000 queries/month; extra queries need Growth plan payable by card or GRT on Arbitrum: https://thegraph.com/docs/en/subgraphs/querying/introduction/
- Studio plan/payment details, GRT on Arbitrum, card billing, and invoices: https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/
- Current billing page showing "$2 per 100,000 queries after the first 100,000 free queries each month": https://thegraph.com/studio/billing/upgrade/
- API key URL/header forms, security warning, spending limits, domain restrictions, and subgraph restrictions: https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/
- Query pricing model docs giving Studio pricing as a reference point: https://thegraph.com/docs/en/gateways/subgraphs/consumer-side/pricing-payments/
- Curation taxes and query-fee share details: https://thegraph.com/docs/en/resources/roles/curating/
- Graph CLI changelog showing hosted-service flags removed: https://github.com/graphprotocol/graph-tooling/blob/main/packages/cli/CHANGELOG.md
- GRT spot price references checked for the rough USD conversion only; recheck live price before budgeting: MetaMask showed about $0.0271/GRT on 2026-09-23, and CoinGecko showed about $0.02674/GRT: https://metamask.io/price/the-graph and https://www.coingecko.com/en/coins/the-graph
