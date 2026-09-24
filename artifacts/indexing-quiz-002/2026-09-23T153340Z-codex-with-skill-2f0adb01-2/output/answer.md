# Production go-live path for our marketplace subgraph

## Short answer

The draft runbook is not a production path for The Graph today.

`graph deploy --hosted-service marketplace` is the old hosted-service mental model. The production path now is:

1. Deploy the built subgraph to Subgraph Studio for staging/testing.
2. Publish that deployment to The Graph Network, which is an onchain action on Arbitrum One.
3. Make sure it is indexed by enough Indexers for production reliability, usually by adding GRT curation signal and/or coordinating with Indexers if the chain/incentives are not enough.
4. Create a Studio API key, restrict it, add billing, and point the app at the gateway endpoint.

The production endpoint is not "free, no tokens, no billing." There is a free allowance, but production usage requires an API key and billing. If we pay with card, this can be a normal monthly SaaS line. If we pay with crypto, the query account is funded with GRT on Arbitrum. Publishing/signaling also involves a wallet, Arbitrum ETH for gas, and optionally GRT curation signal.

## What the draft gets wrong

The hosted service is not the go-live target. The Graph's April 2024 Sunrise post told hosted-service users to upgrade to The Graph Network by June 12, 2024, and said hosted-service endpoints would no longer be operational after the upgrade window. Source: The Graph blog, "Sunbeam Has Begun," April 11, 2024: https://thegraph.com/blog/sunbeam-upgrade-window/

Deploying is not publishing. The current docs say `graph deploy <SUBGRAPH_SLUG>` pushes to Subgraph Studio, and explicitly say that this does not publish to the decentralized network. Studio is where we test, inspect logs, and prepare metadata. Source: The Graph docs, "Deploying Using Subgraph Studio": https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/

The production endpoint uses the gateway and an API key. The docs give the endpoint shape as:

```text
https://gateway.thegraph.com/api/<YOUR_API_KEY>/subgraphs/id/<SUBGRAPH_ID>
```

Source: The Graph docs, "How to Manage API keys": https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/

There is billing. Studio has a Free Plan and Growth Plan. The Free Plan includes 100,000 monthly queries; after that, queries require payment by credit card or GRT. Source: The Graph docs, "Subgraph Studio": https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/

## Correct go-live runbook

1. Confirm network/feature support.

   Check that our marketplace chain is supported on The Graph Network and that our subgraph features are supported by Indexers. The Studio deploy docs call this out before production publication. Source: https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/

2. Create the subgraph in Subgraph Studio.

   Connect the team's wallet or Safe, create the Studio subgraph, get the deploy key, and authenticate the CLI:

   ```bash
   graph auth <DEPLOY_KEY>
   graph codegen
   graph build
   graph deploy <SUBGRAPH_SLUG>
   ```

   `graph deploy` is the staging/private deployment step, not the production publish step. After deployment, test in Studio and with the development query URL. The development URL is rate-limited to 3,000 queries/day, so it is not the production endpoint. Source: https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/

3. Publish to The Graph Network.

   When the deployed version is ready, publish it from Studio or with `graph publish`. Publishing is an onchain transaction against The Graph Network contracts on Arbitrum One, so the publishing wallet needs Arbitrum ETH for gas. The docs say published subgraphs become visible in Graph Explorer and available for Curators and Indexers. Sources:

   - Publishing docs: https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/
   - Publication-flow docs: https://thegraph.com/docs/en/gateways/subgraphs/consumer-side/publication-flows/

   For production, use a Safe/multisig as the owner/publishing wallet rather than one person's EOA. The publication-flow docs recommend multisig workflows for production subgraphs a business depends on. Source: https://thegraph.com/docs/en/gateways/subgraphs/consumer-side/publication-flows/

4. Bootstrap indexing reliability.

   Publication makes the subgraph discoverable, but production reliability depends on Indexers actually syncing and serving it. The Graph docs separate query routing from getting a deployment indexed: paying for live queries only works after Indexers have synced the deployment.

   If our chain has indexing rewards enabled, the normal lever is curation signal: lock GRT on the subgraph so Indexers have an incentive to index it. The docs give two useful current reference points:

   - General developer guidance: subgraph developers are encouraged to curate their own subgraph with at least 3,000 GRT. Source: Tokenomics docs: https://thegraph.com/docs/en/resources/tokenomics/
   - Production QoS guidance as of August 2026: 10,000 GRT typically attracts 5+ Indexers; 5,000 GRT typically attracts 3+; 1,000 GRT typically attracts 1-2. Source: "Incentivizing Syncs": https://thegraph.com/docs/en/gateways/subgraphs/supply-side/incentivizing-syncs/

   My recommendation for a production dApp is to budget for 10,000 GRT of self-signal if we want redundancy, then revisit once we see actual Indexer coverage in Graph Explorer. If we are on a chain without indexing rewards or the subgraph still is not picked up, the same docs say we may need direct/offchain Indexer arrangements while Indexing Payments mature.

5. Create and lock down API keys.

   In Studio, create a production API key. Restrict it to the production subgraph and allowed frontend domains. Set a monthly spending limit in USD. The API key page says keys show query count, GRT spent, and current usage, and supports subgraph/domain restrictions and monthly spending limits. Source: https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/

   Browser note: if the frontend calls the gateway directly, the API key should be treated as exposed even if it is domain-restricted. For stricter control, route queries through our backend. Either way, use spend limits and subgraph restrictions.

6. Add billing and switch the app endpoint.

   Put a card on file or fund the billing balance with GRT. The billing docs say invoices are processed at the end of each month and that all activity, including billing contracts, is now on Arbitrum One. If paying with GRT, we need GRT on Arbitrum and some ETH on Arbitrum for gas when depositing/withdrawing. Source: https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/

   Then configure the frontend/backend endpoint:

   ```text
   https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
   ```

7. Monitor after cutover.

   Before considering this done, verify:

   - subgraph is synced and healthy in Studio/Explorer;
   - multiple Indexers are serving it;
   - gateway queries succeed from production domains;
   - API key spending limits are set;
   - alerting catches indexing errors, stale data, high query volume, and billing-limit exhaustion.

## Budget numbers

### Query cost

The current Studio pricing page says the first 100,000 monthly queries are free and additional usage is "$2 per 100,000 queries." Source: Subgraph Studio Pricing, crawled September 23, 2026: https://thegraph.com/studio-pricing/

Reasoning:

```text
monthly query bill = max(0, total_queries - 100,000) / 100,000 * $2
```

Examples:

| Monthly queries | Billable after free 100k | Estimated monthly cost |
| ---: | ---: | ---: |
| 1,000,000 | 900,000 | $18 |
| 3,000,000 | 2,900,000 | $58 |
| 5,000,000 | 4,900,000 | $98 |
| 10,000,000 | 9,900,000 | $198 |

Budget note: I would re-check the pricing page before committing this, because query pricing is a commercial policy number, not a protocol constant.

### Publishing cost

Publishing costs Arbitrum gas because it is an onchain transaction. The docs do not give a fixed dollar figure; it depends on Arbitrum gas at publish time. Source: publication-flow docs: https://thegraph.com/docs/en/gateways/subgraphs/consumer-side/publication-flows/

Budget line: small variable Arbitrum ETH gas per publish/update. Re-check at execution time.

### Curation / self-signal

Curation signal is locked GRT, not a monthly bill. It can be withdrawn, but signaling incurs a 1% curation tax that is burned. Sources:

- 1% curation tax: https://thegraph.com/docs/en/resources/tokenomics/
- Curators can withdraw signaled GRT, and on Arbitrum are guaranteed to get back the deposited GRT minus tax: https://thegraph.com/docs/en/resources/roles/curating/

If we use the production-oriented 10,000 GRT self-signal target:

```text
locked capital = 10,000 GRT
up-front burn = 1% * 10,000 = 100 GRT
```

For a rough USD translation, CoinMarketCap showed GRT at about $0.0275 on September 23, 2026. Source: CoinMarketCap search result for GRT/USD, crawled September 23, 2026: https://coinmarketcap.com/currencies/the-graph/

At that price:

```text
10,000 GRT locked ~= $275
100 GRT burned ~= $2.75
```

If we choose the older/general 3,000 GRT developer recommendation:

```text
3,000 GRT locked ~= $82.50
30 GRT burned ~= $0.83
```

Budget note: re-check both the GRT/USD price and the current signal guidance before committing. The token price is volatile, and the docs themselves say signal recommendations can be impacted by network activity/community participation.

### Updating the subgraph later

A new production version means another deploy-to-Studio plus publish flow. If curation shares auto-migrate to the newest version, the docs say auto-migration incurs a 0.5% curation tax and developers are discouraged from publishing too frequently. Source: Curating docs: https://thegraph.com/docs/en/resources/roles/curating/

For 10,000 GRT of auto-migrating signal:

```text
0.5% * 10,000 GRT = 50 GRT per migration
```

At the same rough $0.0275/GRT reference, that is about $1.38, plus Arbitrum gas. Re-check before budgeting because GRT price and protocol guidance can move.

## Recommended budget line

For a few million queries/month, assuming we pay Studio by card and self-signal for production redundancy:

```text
One-time / launch:
- Arbitrum ETH gas for publish: variable, re-check at publish time.
- 10,000 GRT self-signal: locked working capital, not spent.
- 100 GRT curation tax: burned up front.

Monthly:
- Query billing: about $58/month at 3M queries, $98/month at 5M queries, using current $2 per 100k over the free 100k.
- No separate monthly hosting fee from us for running Graph Node/Indexers, assuming normal The Graph Network gateway usage.

Per update:
- Arbitrum gas for publish.
- If auto-migrating 10,000 GRT of signal, about 50 GRT migration tax.
```

The numbers I would not lock without a final pre-sprint check are: Studio query price, GRT/USD price, recommended signal size for the target chain, and whether our target chain has indexing rewards enabled or needs Indexer coordination.
