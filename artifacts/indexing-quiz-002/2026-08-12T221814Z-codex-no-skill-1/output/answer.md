# Production runbook: The Graph

Checked against The Graph's current documentation on 2026-08-12.

## What the draft gets wrong

`graph deploy --hosted-service marketplace` is obsolete. The Hosted Service stopped operating on June 12, 2024; queries now use The Graph Network ([Hosted Service sunset announcement](https://thegraph.com/blog/sunsetting-hosted-service/)). `marketplace` also is not a `--host` URL, and current Studio deployment uses a Studio slug after authentication.

The remaining claims are also wrong for production:

- Deploying to Studio is staging, not publishing to the decentralized network. Its development endpoint is capped at **3,000 queries/day** ([Studio deployment docs](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/)).
- The production gateway endpoint requires an **API key**.
- Only the first **100,000 queries/account/month** are free. Higher use needs the Growth plan and billing by credit card or GRT ([querying guide](https://thegraph.com/docs/en/subgraphs/querying/introduction/)).
- Publishing is an onchain action on **Arbitrum One**, so the publishing wallet needs ETH for gas. GRT curation signal is optional but relevant to production redundancy.

## Actual path from local to production

1. **Check network compatibility.** Confirm the manifest's data-source network and every feature used are supported by Network Indexers. Local Graph Node success alone does not prove this. Use the supported-networks and feature-support links in the [Studio deployment docs](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/).

2. **Create the subgraph in Subgraph Studio.** Connect the team's wallet (preferably establish final multisig ownership), create the subgraph/slug, save the deploy key as a CI secret, and authenticate:

   ```sh
   graph auth <DEPLOY_KEY>
   graph codegen
   graph build
   graph deploy <SUBGRAPH_SLUG>
   ```

   Give the version a meaningful semver label. The deploy key is a secret and is distinct from the query API key. Studio permits only three unpublished deployments per account ([Studio deployment docs](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/)).

3. **Treat Studio as staging.** Wait for sync, inspect indexing errors/logs and health, compare representative production queries/results with local results, and test reorg-sensitive/current-block behavior. The Studio URL (`api.studio.thegraph.com/.../<version>`) is limited to 3,000 queries/day and is not the frontend production URL.

4. **Publish to The Graph Network.** In Studio click **Publish**, or with graph-cli >=0.73 run `graph publish` after `graph codegen && graph build`; connect the owner wallet and publish on Arbitrum One. Publishing makes the subgraph visible in Explorer and available to Indexers ([publishing docs](https://thegraph.com/docs/en/subgraphs/developing/publishing/publishing-a-subgraph/)). This is the separate onchain step that `graph deploy` does not perform.

5. **Make indexing production-worthy.** Wait until the published deployment is synced and queryable; inspect Explorer for active Indexers and test the gateway. The Sunrise Upgrade Indexer ensures all subgraphs are indexed, but The Graph recommends at least **3,000 GRT** of self-curation signal for an indexing-reward-eligible subgraph to attract additional Indexers and improve availability/latency ([publishing docs](https://thegraph.com/docs/en/subgraphs/developing/publishing/publishing-a-subgraph/)). Signal is optional and withdrawable capital, not a hosting fee; a **1% curation tax is burned** when signaling ([Glossary](https://thegraph.com/docs/en/resources/glossary/)). Price the 3,000 GRT and tax at purchase time, and verify the recommendation before budgeting.

6. **Create and secure a consumer API key.** In Studio's API Keys tab create a production key and restrict it to this subgraph and allowed frontend domains. Use separate staging/production keys so usage and revocation are isolated. The production endpoint is:

   ```text
   https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
   ```

   This endpoint/key format comes from The Graph's [application-querying guide](https://thegraph.com/docs/en/subgraphs/querying/from-an-application/). A browser key is necessarily visible to users; restrictions limit abuse. For stronger secrecy/control, proxy through a backend and rate-limit there.

7. **Configure billing before traffic.** The Free plan supplies 100,000 queries/month. Growth bills usage above that by **credit card** (monthly invoice) or **GRT**. GRT billing requires a sufficient deposited balance of GRT on Arbitrum; depositing/withdrawing is an Arbitrum transaction and needs ETH for gas. GRT is the only accepted crypto, but it is not required if using a card ([Studio billing docs](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/)). Add usage alerts and budget for abuse as well as expected traffic.

8. **Cut over and operate.** Put the gateway URL in production configuration, smoke-test via POST, monitor sync/indexing health, gateway errors, latency, usage and invoice balance, then remove the local/Studio URL. For upgrades: deploy a new version to Studio, validate, then publish it; do not assume deployment alone changes production. Keep rollback/query tests and confirm multiple Indexers after each publication.

## Budget

### Stand-up

- **The Graph setup/hosting fee: $0.** The Graph states no setup fee or monthly infrastructure fee ([benefits/pricing page](https://thegraph.com/docs/en/resources/benefits/)).
- **Arbitrum ETH gas: nonzero and variable** for publication and later onchain updates; also for GRT billing deposits/withdrawals and curation transactions if used. Get a live wallet quote immediately before approval. No defensible fixed USD amount exists because gas and ETH/USD move.
- **Optional reliability signal: 3,000 GRT locked.** At spot price `P`, capital required is `3,000 × P`; the initial 1% curation tax is approximately `30 GRT` (subject to transaction mechanics), plus gas. Remaining signal is withdrawable and exposed to GRT price/curation-pool risk. Re-check both the 3,000-GRT recommendation and live GRT price.

### Monthly at a few million queries

The official page says **100,000/month free**, then usage-based pricing. Another official page quotes an average **$20 per million queries ($0.00002/query)**, explicitly dated **March 2024** and says actual query costs vary ([benefits/pricing page](https://thegraph.com/docs/en/resources/benefits/)). Therefore a transparent planning calculation at 3,000,000 requests is:

```text
billable requests = 3,000,000 - 100,000 = 2,900,000
illustrative query cost = 2.9 × $20 = about $58/month
```

Do **not** commit $58 as a quote. The same official page's table says **$120/month for ~3M queries**, contradicting its stated $20/million rate (and its 30M row also says $1,200). Query complexity/Indexer cost models can vary, and the quoted average is old. For the budget, use the live estimator in Studio while upgrading to Growth, capture its date and assumptions, then add headroom. A conservative placeholder based on The Graph's own 3M table is **$120/month plus contingency**, to be replaced by that live estimate.

Whether paid by card or GRT, pricing is denominated in USD according to the cited pricing page. Card avoids treasury exposure; GRT requires maintaining balance and ETH for occasional Arbitrum transactions. There is no recurring publisher hosting bill and no requirement to run an Indexer or stake the Indexer's **100,000 GRT minimum**—that requirement belongs to node operators, not subgraph developers.

## Numbers to re-check at budget approval

| Figure | Source | Why re-check |
|---|---|---|
| Hosted Service ended 2024-06-12 | [sunset announcement](https://thegraph.com/blog/sunsetting-hosted-service/) | Historical; unlikely to change |
| Studio development cap: 3,000/day | [deployment docs](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/) | Product limit can change |
| Free allowance: 100,000/month | [querying guide](https://thegraph.com/docs/en/subgraphs/querying/introduction/) | Plan can change |
| Average $20/million, March 2024 | [benefits/pricing page](https://thegraph.com/docs/en/resources/benefits/) | Old average; actual costs vary |
| Official 3M example: $120/month | [same pricing page](https://thegraph.com/docs/en/resources/benefits/) | Conflicts with $20/million; use live Studio estimate |
| Recommended self-signal: at least 3,000 GRT | [publishing docs](https://thegraph.com/docs/en/subgraphs/developing/publishing/publishing-a-subgraph/) | Optional and protocol conditions change |
| Curation tax: 1% | [Glossary](https://thegraph.com/docs/en/resources/glossary/) | Protocol parameter can change |
| Gas, ETH/USD, GRT/USD | Live wallet/market quote at transaction time | Intrinsically volatile |

Bottom line: budget neither “free forever” nor server rental. Budget variable query fees after 100,000/month, small variable Arbitrum gas, and optionally 3,000 GRT of working capital plus its 1% tax to attract more Indexers. Use Studio's live estimator—not the internally inconsistent old marketing example—for the committed monthly number.
