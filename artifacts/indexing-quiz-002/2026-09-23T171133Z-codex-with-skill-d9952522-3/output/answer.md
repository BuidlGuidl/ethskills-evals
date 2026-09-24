# Production go-live path for our The Graph subgraph

Short version: the draft runbook is describing the old hosted-service world. That is not the production path today. The hosted service is no longer active as of June 12, 2024; production traffic is served through The Graph Network, with a Subgraph Studio API key and metered billing after the free tier. Source: The Graph's hosted-service sunset post says "As of June 12th, 2024, the hosted service is no longer active" and that queries are now powered by The Graph Network: https://thegraph.com/blog/sunsetting-hosted-service/

## What the draft gets wrong

The proposed `graph deploy --hosted-service marketplace` step is wrong for production. The Hosted Service is gone for production subgraphs, and The Graph docs now describe `graph deploy <SUBGRAPH_SLUG>` as a deployment to Subgraph Studio, not publication to the decentralized network. Studio deployment is for testing/staging; The Graph's docs explicitly say deploying to Studio "won't publish your Subgraph to the decentralized network." Source: https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/

The "free public endpoint, no tokens, no billing" part is also wrong. There is a free allowance, but production queries require an API key, and usage past 100,000 queries/month requires payment by credit card or GRT. Sources: Subgraph Studio querying plans: https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/ and current Studio billing page: https://thegraph.com/studio/billing/upgrade/

The frontend should not rely on the Studio development query URL. After a Studio deploy, the endpoint looks like `https://api.studio.thegraph.com/query/<ID>/<SUBGRAPH_NAME>/<VERSION>` and is for testing only. The docs say it is rate-limited; the Studio deploy docs state the development query URL is limited to 3,000 queries/day. The production endpoint comes only after publishing and looks like `https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>`. Sources: https://thegraph.com/docs/en/subgraphs/querying/from-an-application/ and https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/

## Correct go-live runbook

1. Confirm production fit before touching the network.
   - Confirm the chain we index is supported by The Graph Network.
   - Run `graph codegen`, `graph build`, unit tests, and a local Graph Node sync.
   - Decide who owns the subgraph: ideally a team wallet or multisig, not an engineer's personal wallet.
   - Decide the production API-key owner and billing owner.

2. Create the subgraph in Subgraph Studio.
   - Open Subgraph Studio and connect the owner wallet.
   - Create the subgraph and note its `<SUBGRAPH_SLUG>`.
   - Get the deploy key from Studio.
   - Authenticate locally:

   ```bash
   graph auth <DEPLOY_KEY>
   ```

3. Deploy to Subgraph Studio for final pre-prod validation.

   ```bash
   graph deploy <SUBGRAPH_SLUG>
   ```

   Use a semver-like version label, for example `1.0.0`. This pushes the build to Studio, where we can inspect logs, sync status, metadata, and the Studio test endpoint. It is not production yet. Source: https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/

4. Test the Studio deployment.
   - Run the exact production GraphQL operations against the Studio test endpoint.
   - Check Studio logs for indexing errors.
   - Validate entities, ordering, pagination, and any derived fields against known marketplace transactions.
   - Do not point production frontend traffic at this endpoint; it is rate-limited.

5. Publish to The Graph Network.
   - Publish from Studio's Publish button, or use the current CLI publish flow:

   ```bash
   graph publish
   ```

   - Publishing is an onchain action on The Graph Network contracts on Arbitrum One, so the publishing wallet needs ETH on Arbitrum for gas. Source: publication-flow docs: https://thegraph.com/docs/en/gateways/subgraphs/consumer-side/publication-flows/
   - Publication makes the subgraph visible in Graph Explorer and available to Indexers. Source: https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/

6. Add curation signal if we want production-grade indexer coverage.
   - The Graph docs recommend self-curating an eligible subgraph with at least 3,000 GRT to attract additional Indexers. Source: publishing docs: https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/
   - This is not the same as a monthly hosting bill. It is GRT locked as curation signal, with protocol taxes and market risk.
   - Curation tax: The Graph's curation docs say every curation incurs a 1% curation tax, and auto-migration to new versions incurs a 0.5% curation tax. Source: https://thegraph.com/docs/en/resources/roles/curating/
   - Practical implication: if we signal 3,000 GRT, 30 GRT is burned as the 1% curation tax. The remaining signal is locked and can be withdrawn later, subject to protocol mechanics, market price changes, gas, and any later migration/withdrawal taxes described in the docs.

7. Wait for production indexing to be healthy.
   - Open the subgraph in Graph Explorer.
   - Confirm at least one Indexer is serving it and that sync status is caught up.
   - For reliability, watch how many Indexers pick it up after signal. The docs say curation signal attracts additional Indexers and improves latency/availability; I would treat this as a go-live gate rather than a nice-to-have for a production dApp.

8. Create and lock down API keys.
   - Create a Subgraph Studio API key.
   - Assign the key only to our subgraph.
   - Add domain restrictions for our production frontend domain.
   - Set a monthly spending limit in USD.
   - Put key ownership and rotation into the runbook.
   - The Graph docs say API keys are required for subgraph queries and can be restricted by domain/subgraph with spending limits. Source: https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/

9. Configure billing before production traffic.
   - The Free Plan includes 100,000 queries/month.
   - Past that, use the Growth Plan with credit card billing or GRT billing.
   - If paying by GRT, The Graph docs say billing accepts GRT on Arbitrum and requires ETH on Arbitrum for gas. They also list the current Arbitrum One GRT token address as `0x9623063377AD1B27544C965cCd7342f7EA7e88C7`; re-check the docs before moving funds. Source: https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/

10. Cut over the frontend.
    - Use the production gateway URL:

    ```text
    https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
    ```

    - Use POST requests from the GraphQL client.
    - If the API key is embedded in a public web frontend, assume it is visible. Domain restrictions, subgraph restrictions, and spending limits are mandatory. For stricter key secrecy, route queries through our backend, but then we own that proxy's availability and rate limiting.

11. Operate it.
    - Monitor query volume, current-period cost, GRT spent if using GRT billing, indexing health, indexing errors, and gateway status.
    - Avoid casual production republishes. A new version is another onchain publish/update path, and auto-migrated curation signal has a 0.5% tax per migration according to the curation docs.

## Budget reasoning

### One-time / go-live costs

Studio deploy: $0. The hosted-service sunset post describes Studio as supporting no-cost deploy/test before production publication. Source: https://thegraph.com/blog/sunsetting-hosted-service/

Publish transaction: variable Arbitrum gas, paid in ETH. This must be re-checked at publish time because gas changes constantly. Source for the requirement, not the dollar amount: https://thegraph.com/docs/en/gateways/subgraphs/consumer-side/publication-flows/

Curation signal: recommended, not a flat SaaS fee. The docs recommend at least 3,000 GRT for eligible subgraphs to attract additional Indexers. At a CoinGecko spot price I saw on September 23, 2026 of roughly $0.0267/GRT, 3,000 GRT is about $80. That spot price is highly volatile and must be re-checked before budget approval. Source for the 3,000 GRT recommendation: https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/ Source for spot price check: https://www.coingecko.com/en/coins/the-graph

Curation tax on initial 3,000 GRT signal: 1% = 30 GRT burned. At roughly $0.0267/GRT, that is about $0.80, plus gas. Re-check the GRT price and current protocol docs before committing this number. Source for tax rate: https://thegraph.com/docs/en/resources/roles/curating/

Future version migrations: if our curation signal auto-migrates to a new production version, The Graph docs say the migration incurs a 0.5% curation tax. On 3,000 GRT, that is 15 GRT, or about $0.40 at the same September 23, 2026 spot price, plus gas. Source: https://thegraph.com/docs/en/resources/roles/curating/

### Monthly query costs

Current public Studio billing says: first 100,000 queries/month are free, then $2 per 100,000 queries after that. Source: https://thegraph.com/studio/billing/upgrade/ The Subgraph Studio docs also say Growth Plan usage beyond 100,000 monthly queries is payable by credit card or GRT. Source: https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/

Using that current price:

| Monthly query volume | Paid queries after free 100K | Estimated query bill |
| ---: | ---: | ---: |
| 1,000,000 | 900,000 | $18/month |
| 2,000,000 | 1,900,000 | $38/month |
| 3,000,000 | 2,900,000 | $58/month |
| 5,000,000 | 4,900,000 | $98/month |

Formula: `max(0, monthly_queries - 100000) / 100000 * $2`.

The number I would put in the draft budget for "a few million queries" is therefore about $60/month for 3M queries, plus a small buffer. I would not commit that without re-checking the live Studio billing page, because query pricing is a product price and can change. I would budget separately for Arbitrum gas and curation signal, because those depend on ETH/GRT market prices and on how much signal we choose to add.

## Recommended runbook replacement

Replace the draft ship step with:

```bash
# Build and validate
graph codegen
graph build

# Authenticate to Subgraph Studio
graph auth <DEPLOY_KEY>

# Deploy to Studio for final testing, not production
graph deploy <SUBGRAPH_SLUG>

# After Studio checks pass, publish to The Graph Network from Studio or CLI
graph publish
```

Then, before frontend cutover:

- Confirm the production subgraph is published and synced in Graph Explorer.
- Add recommended GRT curation signal if the subgraph is eligible and production reliability matters.
- Create a Studio API key, restrict it to our subgraph and production domains, and set a USD spending limit.
- Upgrade billing to Growth Plan if expected traffic exceeds 100,000 queries/month.
- Point the frontend at `https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>`.

## Re-check before committing the budget

Re-check the `$2 per 100,000 queries after the first 100,000 free` price on the live Studio billing page.

Re-check GRT/USD before buying or signaling GRT.

Re-check Arbitrum ETH gas before publishing.

Re-check the GRT token address on The Graph docs before transferring funds.

Re-check whether our chain/subgraph features are eligible for indexing rewards; the docs say signal on a non-eligible subgraph will not attract additional Indexers.
