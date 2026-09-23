# The Graph production go-live path for our marketplace subgraph

As of 2026-09-23, the draft runbook is using the old Hosted Service story. The production path for a dApp today is: deploy to Subgraph Studio for staging, publish the subgraph on-chain to The Graph Network, make sure it has enough curation signal / indexer coverage, create a Subgraph Studio API key, put billing controls behind that key, and point the frontend at the Graph Explorer/Gateway query URL.

## What the draft gets wrong

The draft says:

> `graph deploy --hosted-service marketplace`

Problems:

1. **Hosted Service is not the production target.** The Graph started sunsetting Hosted Service years ago. Their sunsetting post says new subgraphs for Graph Network-supported chains had to use Subgraph Studio / The Graph Network, and that production queries should be served by decentralized Indexers rather than Hosted Service. Source: The Graph, "The Road to Sunsetting the Hosted Service" [https://thegraph.com/blog/sunsetting-hosted-service/](https://thegraph.com/blog/sunsetting-hosted-service/).

2. **The command is wrong for the current flow.** Current docs say `graph deploy <SUBGRAPH_SLUG>` deploys to Subgraph Studio, where it is staged and tested. It does **not** publish to the decentralized network. Source: The Graph deploy docs [https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/).

3. **"Free public endpoint, no tokens, no billing" is wrong.** The production query URL requires an API key. The free allowance is 100,000 queries/month; beyond that, we need the Growth plan and pay by credit card or GRT on Arbitrum. Source: The Graph querying docs [https://thegraph.com/docs/en/subgraphs/querying/introduction/](https://thegraph.com/docs/en/subgraphs/querying/introduction/) and Subgraph Studio docs [https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/).

4. **"Deploy" and "publish" are different.** Studio deployment is a staging/testing action. Publishing is an on-chain action on The Graph Network that makes the subgraph available to decentralized Indexers, removes Studio staging limits, and makes it publicly searchable/queryable in Graph Explorer. Source: The Graph quick start [https://thegraph.com/docs/en/subgraphs/quick-start/](https://thegraph.com/docs/en/subgraphs/quick-start/).

## Correct go-live runbook

1. **Preflight the subgraph for network support.**
   - Confirm the marketplace chain is a The Graph Network-supported network.
   - Confirm we are not using unsupported subgraph features for that network.
   - Source: The Graph deploy docs say network-supported Indexers require the subgraph to index a supported network and point to the feature support matrix.

2. **Create / use the Subgraph Studio entry.**
   - Open Subgraph Studio, connect the team wallet, and create the subgraph slug.
   - For production, use a team-controlled wallet or Safe/multisig for ownership rather than one engineer's EOA.
   - Source: publication-flow docs recommend multisig for production subgraphs: [https://thegraph.com/docs/en/gateways/subgraphs/consumer-side/publication-flows/](https://thegraph.com/docs/en/gateways/subgraphs/consumer-side/publication-flows/).

3. **Authenticate the CLI and deploy to Studio.**
   - Install/update CLI: `npm install -g @graphprotocol/graph-cli@latest`.
   - Authenticate with the Studio deploy key: `graph auth <DEPLOY_KEY>`.
   - Build: `graph codegen && graph build`.
   - Deploy to Studio: `graph deploy <SUBGRAPH_SLUG>`.
   - This is still staging, not production. Studio's development query URL is limited to 3,000 queries/day. Source: The Graph deploy docs.

4. **Test the Studio deployment.**
   - Check indexing logs and indexing health in Studio.
   - Run the same GraphQL queries the frontend needs.
   - Confirm the deployment is synced to chain head, has no fatal indexing errors, and returns the same shape/data as local Graph Node.

5. **Publish to The Graph Network.**
   - From Studio: click Publish, select the network, review metadata, and sign the Arbitrum transaction.
   - Or via CLI: run `graph publish`, then complete the browser wallet flow.
   - Publishing is on-chain against The Graph Network contracts on Arbitrum One, so the publishing wallet needs ETH on Arbitrum for gas.
   - Source: quick start and publication-flow docs.

6. **Add curation signal so Indexers pick it up.**
   - A published subgraph is unlikely to be picked up by Indexers without curation signal. Signal is locked GRT associated with the subgraph.
   - The quick start currently recommends **3,000+ GRT** to incentivize indexing; another current CLI doc says **at least 3,000 GRT** to attract 2-3 Indexers.
   - A newer gateway/operator doc gives rough August 2026 guidance: **1,000 GRT** for 1-2 Indexers, **5,000 GRT** for 3+ Indexers, **10,000 GRT** for 5+ Indexers.
   - Budget recommendation: use **5,000-10,000 GRT of self-signal** if this frontend is production-critical and we want redundancy. Re-check this before committing because The Graph's own docs currently show both 3,000+ and the 1k/5k/10k guidance.
   - Sources: overview [https://thegraph.com/docs/en/subgraphs/overview/](https://thegraph.com/docs/en/subgraphs/overview/), quick start, CLI install docs [https://thegraph.com/docs/en/subgraphs/developing/creating/install-the-cli/](https://thegraph.com/docs/en/subgraphs/developing/creating/install-the-cli/), and indexing-incentive docs [https://thegraph.com/docs/en/gateways/subgraphs/supply-side/incentivizing-syncs/](https://thegraph.com/docs/en/gateways/subgraphs/supply-side/incentivizing-syncs/).

7. **Wait for indexing coverage and verify the public endpoint.**
   - Use Graph Explorer to confirm the published subgraph is discoverable, synced, and has Indexers serving it.
   - If indexer coverage is thin, increase signal, contact indexers / Edge & Node support, or negotiate indexing support if the chain/subgraph economics do not attract Indexers by themselves.

8. **Create and lock down API keys.**
   - Each query URL requires a valid API key.
   - Create one key for production frontend, and separate keys for staging / backend / analytics.
   - Restrict by domain where possible.
   - Set spend limits / monitor usage in Studio billing.
   - Source: Studio FAQ says API keys are created in Studio and domains can be restricted: [https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/studio-faq/](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/studio-faq/).

9. **Set up billing before frontend cutover.**
   - Free plan: 100,000 queries/month.
   - Growth plan: queries after the first 100,000/month require payment by credit card or GRT.
   - If paying by card, Studio bills at month end.
   - If paying by GRT, the billing balance uses GRT on Arbitrum; the wallet also needs ETH on Arbitrum for gas.
   - Source: Subgraph Studio docs.

10. **Cut over the frontend.**
    - Get the production query URL from Graph Explorer.
    - Use POST GraphQL requests.
    - Put the Studio API key in the endpoint/config pattern The Graph provides; do not expose any deploy key.
    - Keep local Graph Node / a secondary provider / cached API path as an incident fallback if our frontend cannot tolerate a Graph Network outage or indexing lag.

## Budget reasoning

### Query billing

Current listed Subgraph Studio pricing:

- First **100,000 queries/month free**.
- Then **$2 per additional 100,000 queries**.
- Source: The Graph Studio pricing page [https://thegraph.com/studio-pricing/](https://thegraph.com/studio-pricing/) and billing upgrade page [https://thegraph.com/studio/billing/upgrade/](https://thegraph.com/studio/billing/upgrade/). The gateway pricing docs also use the same $2 / 100k figure as the Studio reference rate: [https://thegraph.com/docs/en/gateways/subgraphs/consumer-side/pricing-payments/](https://thegraph.com/docs/en/gateways/subgraphs/consumer-side/pricing-payments/).

Math:

- Formula: `max(0, monthly_queries - 100,000) / 100,000 * $2`.
- 1,000,000 queries/month: `(1,000,000 - 100,000) / 100,000 * $2 = $18/month`.
- 2,000,000 queries/month: `$38/month`.
- 3,000,000 queries/month: `$58/month`.
- 5,000,000 queries/month: `$98/month`.

For "a few million queries", the query bill is roughly **$40-$100/month**, assuming Studio's current public rate and no enterprise/gateway custom arrangement.

Re-check before budget lock: the **$2 per 100,000** rate, and whether the 100,000 free allowance applies at the exact account/org/key/subgraph level we will use. The docs phrase this slightly differently in different places.

### Production stand-up costs

1. **Studio deploy/test:** $0 direct fee, but development query URL is rate-limited to 3,000/day. Source: deploy docs.

2. **Publish transaction:** variable Arbitrum gas, paid in ETH on Arbitrum. Usually small, but I would budget a buffer rather than a fixed number because gas moves.

3. **Curation signal:** recommended GRT locked to attract Indexers.
   - Minimum practical guidance from docs: 3,000+ GRT.
   - More production-redundant guidance: 5,000-10,000 GRT.
   - This is mostly **locked capital**, not monthly spend, but it has token price risk and opportunity cost.
   - A 1% curation tax is incurred when signaling; auto-migrating signal during version updates can incur a 0.5% migration tax. Source: curating docs [https://thegraph.com/docs/en/resources/roles/curating/](https://thegraph.com/docs/en/resources/roles/curating/).

At the GRT/USD snapshot I found on 2026-09-23, GRT was around **$0.026/GRT**. Source: Investing.com GRT/USD snapshot [https://www.investing.com/crypto/the-graph/grt-usd-historical-data](https://www.investing.com/crypto/the-graph/grt-usd-historical-data). Re-check this immediately before buying/locking tokens.

Rough signal sizing at $0.026/GRT:

- 3,000 GRT: about **$78** locked; 1% tax is 30 GRT, about **$0.78**.
- 5,000 GRT: about **$130** locked; 1% tax is 50 GRT, about **$1.30**.
- 10,000 GRT: about **$260** locked; 1% tax is 100 GRT, about **$2.60**.

Those USD numbers are intentionally marked as volatile. The GRT quantity guidance matters more than today's USD conversion.

## Budget line I would use

For launch:

- **One-time / launch:** Arbitrum gas for publish + signal transactions, plus **5,000-10,000 GRT self-signal** for production indexer coverage. Treat the GRT as locked treasury capital, not pure spend, but account for the 1% curation tax and token price volatility.
- **Monthly query billing:** at current public Studio pricing, **$58/month for 3M queries** or **$98/month for 5M queries**, after the 100k free allowance.
- **Operational caveat:** if the subgraph is on a chain without enough indexing incentives, or if we need contractual uptime/support, budget for an indexer/gateway/enterprise arrangement separately. The public Studio/Gateway query bill does not by itself guarantee bespoke SLA coverage.

The important correction to the runbook is: production is not "push to Hosted Service and query for free." Production is "publish to The Graph Network, fund/secure the API key and billing path, add enough GRT signal for Indexers, verify indexing coverage, then cut the frontend over to the API-keyed Graph Explorer/Gateway endpoint."
