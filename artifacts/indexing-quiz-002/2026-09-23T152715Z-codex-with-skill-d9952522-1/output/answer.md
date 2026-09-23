# Production runbook note: The Graph subgraph go-live

Checked on 2026-09-23. The teammate draft is describing the old hosted-service world. Today, the production path is Subgraph Studio plus publishing to The Graph Network, with metered queries through a Gateway endpoint and an API key.

## What the draft gets wrong

The old hosted service is gone. The Graph's own sunset post says that, as of June 12, 2024, the hosted service is no longer active and queries are powered by The Graph Network instead. Source: The Graph, "The Road to Sunsetting the Hosted Service" (`https://thegraph.com/blog/sunsetting-hosted-service/`).

`graph deploy` is not the production publish step. Current docs say deploying with the CLI pushes the subgraph to Subgraph Studio, where it can be tested, but "deploying is not the same as publishing." Source: The Graph docs, "Deploying Using Subgraph Studio" (`https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/`).

There is no free, unauthenticated, unlimited production endpoint. Production query URLs require an API key, and Subgraph Studio starts with 100,000 free queries per month before paid usage. Sources: The Graph docs, "How to Query a Subgraph Using The Graph" (`https://thegraph.com/docs/en/subgraphs/querying/introduction/`) and "How to Manage API keys" (`https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/`).

There are tokens and billing details. Query usage can be paid by credit card or with GRT on Arbitrum. Publishing is an on-chain action on Arbitrum One, so the publishing wallet needs ETH for gas. Curation/bootstrap signal, if used, is in GRT. Sources: The Graph docs, "Subgraph Studio" billing section (`https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/`) and "Enabling Publication Flows" (`https://thegraph.com/docs/en/gateways/subgraphs/consumer-side/publication-flows/`).

## Correct go-live path

1. Confirm the target chain and subgraph features are supported by The Graph Network.

   Check the supported-networks page and feature support matrix before budgeting the production path. If the chain is not supported for decentralized-network subgraphs, the fallback is running your own Graph Node or another indexer stack. Source: The Graph docs, "Supported Networks" (`https://thegraph.com/docs/en/supported-networks/`).

2. Create the subgraph in Subgraph Studio and authenticate the CLI.

   In Studio, connect the team wallet, create or select the subgraph, and get the deploy key. Then run:

   ```bash
   graph auth <DEPLOY_KEY>
   graph codegen
   graph build
   graph deploy <SUBGRAPH_SLUG>
   ```

   This deploys a version to Studio for staging/testing. It does not publish the production network subgraph. The Studio development query URL looks like:

   ```text
   https://api.studio.thegraph.com/query/<ID>/<SUBGRAPH_NAME>/<VERSION>
   ```

   That endpoint is for testing and is rate-limited. The docs currently state 3,000 queries per day for the development URL. Source: "Deploying Using Subgraph Studio" and "Querying from an Application" (`https://thegraph.com/docs/en/subgraphs/querying/from-an-application/`).

3. Publish the tested deployment to The Graph Network.

   When the Studio deployment is synced and verified, publish it from Studio or with the CLI:

   ```bash
   graph codegen && graph build
   graph publish
   ```

   Publishing makes the subgraph visible in Graph Explorer and available for indexers to index. The docs say published subgraphs are published to Arbitrum One, while the indexed data can come from any supported network. Publishing is an on-chain transaction, so use the team-controlled wallet or, preferably for production, a Safe/multisig that holds the subgraph ownership. Sources: "Publishing a Subgraph to the Decentralized Network" (`https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/`) and "Enabling Publication Flows."

4. Bootstrap indexing quality.

   The Sunrise/Upgrade Indexer exists as a fallback path, but production reliability improves when more indexers have an incentive to index the subgraph. The Graph docs recommend that eligible subgraph developers curate their own subgraph with at least 3,000 GRT to attract additional indexers. Curation is optional in the sense that it is not a CLI prerequisite for every publish, but it is a real production-readiness lever. Sources: "Publishing a Subgraph to the Decentralized Network" and "Tokenomics of The Graph Network" (`https://thegraph.com/docs/en/resources/tokenomics/`).

5. Create the production API key and billing setup.

   In Subgraph Studio, create an API key, assign/restrict it to the subgraph, add domain restrictions, and set a monthly spending limit. The production endpoint has this shape:

   ```text
   https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
   ```

   Source: "How to Manage API keys" and "Querying from an Application."

   Important frontend note: The docs say not to hardcode or expose API keys in client-side apps, even though the query URL embeds a key. For a production dApp, either proxy queries through your backend/serverless edge or use a tightly restricted key with explicit subgraph and domain restrictions and a spending cap. Source: "How to Manage API keys."

6. Cut over the app and monitor.

   Replace the local/Studio URL with the production Gateway URL, run smoke tests against mainnet data, monitor the API key's query count and GRT/USD spend in Studio, and subscribe to The Graph status page. As of my check, the public status page listed Network Gateway, Queries, Subgraph Studio, Subgraph Health, and related systems as operational with 100% over the displayed 90-day window. Source: The Graph status page (`https://status.thegraph.com/`).

   If the app needs contractual uptime, latency ceilings, dedicated capacity, or priority support, the open network by itself may not be enough. The Graph docs say enterprise/SLA environments may require dedicated indexing by a Gateway operator. Source: "Gateway Indexing Approaches" (`https://thegraph.com/docs/en/gateways/subgraphs/consumer-side/indexing-approaches/`).

## Budget reasoning

### One-time / go-live costs

Deploying to Studio for testing: no direct query bill for normal staging use, but the Studio development endpoint is rate-limited and has fair-use limits. The current fair-use policy lists 10 GB free storage for the Upgrade Indexer, requires subgraphs to sync within 14 days, and says users who exceed limits need to move to a paid plan or other arrangements. Source: "Fair Use Policy" (`https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/fair-use-policy/`).

Publishing transaction: budget Arbitrum One ETH gas. I would budget this as a small operational wallet line, not a fixed vendor fee. The live amount depends on Arbitrum and Ethereum data fees at publish time, so re-check in-wallet before signing. The Graph source for the requirement is "Enabling Publication Flows"; gas price itself should be checked live on Arbiscan (`https://arbiscan.io/gastracker`) or the wallet quote.

Curation/bootstrap signal: recommended budget is 3,000 GRT if the subgraph is eligible and we want to attract additional indexers. This is capital committed, not a normal monthly SaaS fee. The curation tax is 1% and is burned. At the CoinGecko price I saw today, GRT was about $0.02674, so:

```text
3,000 GRT * $0.02674/GRT = $80.22 committed
1% curation tax = 30 GRT = about $0.80 irrecoverable at that price
```

Sources: 3,000 GRT recommendation and 1% curation tax from The Graph "Tokenomics" and "Curating" docs (`https://thegraph.com/docs/en/resources/roles/curating/`); live GRT price from CoinGecko (`https://www.coingecko.com/en/coins/the-graph`). Re-check the GRT/USD price before budgeting because it moves continuously. Also re-check whether 3,000 GRT is still the right operational target; The Graph docs explicitly say that number may be affected by network activity and community participation.

Future version publishes: if curators use auto-migration, publishing new versions can impose curation-tax costs on migrated signal. The docs describe a 0.5% curation tax on auto-migration. This matters if we plan frequent production schema/version updates. Source: "Curating."

### Monthly query costs

The current public pricing reference I found is:

```text
100,000 subgraph queries / month free
$2 per additional 100,000 queries
```

Sources: The Graph query docs state the 100,000 free monthly quota and Growth Plan usage billing; the Gateway pricing docs use Edge & Node's Subgraph Studio pricing as the reference and give "$2 per additional 100,000 queries." See `https://thegraph.com/docs/en/subgraphs/querying/introduction/` and `https://thegraph.com/docs/en/gateways/subgraphs/consumer-side/pricing-payments/`.

For "a few million queries," the math is:

```text
monthly_bill = max(0, queries - 100,000) / 100,000 * $2

1,000,000 queries/month: 900,000 paid = 9 units * $2 = $18/month
3,000,000 queries/month: 2,900,000 paid = 29 units * $2 = $58/month
5,000,000 queries/month: 4,900,000 paid = 49 units * $2 = $98/month
10,000,000 queries/month: 9,900,000 paid = 99 units * $2 = $198/month
```

These are plan-pricing estimates, not guarantees of future price. Re-check The Graph's live Subgraph Studio pricing page before committing the budget: `https://thegraph.com/studio-pricing/`.

Payment mechanics:

- Credit card path: put the team on the Growth Plan, keep an active card on file, and pay month-end invoices for queries beyond the free quota.
- GRT path: hold GRT on Arbitrum, deposit it to the Studio billing balance, and keep enough GRT to cover invoices. Depositing/withdrawing GRT involves Arbitrum wallet transactions and ETH gas.
- Controls: set API-key spending limits, restrict allowed domains, restrict the key to the production subgraph, and monitor query counts and spend.

## Runbook replacement for the draft

Replace the draft step with this:

```text
Ship step:
1. Deploy the tested version to Subgraph Studio with `graph deploy <SUBGRAPH_SLUG>`.
2. Verify Studio sync, logs, and staging queries against `https://api.studio.thegraph.com/query/...`.
3. Publish the verified version to The Graph Network from Studio or with `graph publish`, signing from the team Safe/multisig on Arbitrum One.
4. Optionally add curation signal, currently recommended at 3,000 GRT for eligible subgraphs, to improve indexer incentives.
5. Create a production Studio API key, restrict it to our subgraph and frontend domain/proxy, set a monthly spend cap, and fund billing by credit card or GRT.
6. Update the frontend/server proxy to use `https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>`.
7. Smoke test, monitor Studio usage/spend, monitor subgraph health, and subscribe to The Graph status page.
```

The short version for the sprint plan: production is not "free hosted service, no tokens, no billing." It is "publish to The Graph Network, query through a metered Gateway endpoint with an API key, pay after the free monthly quota, and optionally use GRT curation signal to improve indexing quality."
