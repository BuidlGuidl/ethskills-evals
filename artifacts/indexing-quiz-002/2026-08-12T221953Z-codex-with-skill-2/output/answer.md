# Production runbook: marketplace subgraph

## Bottom line

The draft is obsolete. The Hosted Service stopped operating on **June 12, 2024**. `graph deploy --hosted-service marketplace` is not today's production route. The supported route is:

1. deploy a version to **Subgraph Studio** for staging;
2. verify it finishes syncing and behaves correctly there;
3. **publish** it onchain to The Graph Network (currently on Arbitrum One);
4. wait for network indexing and verify health/indexer coverage;
5. create and secure a gateway API key, enable billing, and point production at the network gateway URL.

Studio deployment/testing is free within its limits. Publishing requires an Arbitrum transaction (ETH gas). Production queries require an API key and are free only for the first **100,000 queries/account/month**; usage above that is billed. GRT is optional if paying query bills by card, but ETH on Arbitrum is still required for publishing. GRT curation signal is economically distinct from query billing: it is not a monthly hosting fee, but locking signal may be prudent for indexer diversity.

## What the draft gets wrong

- **The target no longer exists:** The Graph says the Hosted Service has been inactive since June 12, 2024. [Hosted Service sunset](https://thegraph.com/blog/sunsetting-hosted-service/)
- **Deploy is not publish:** `graph deploy <SUBGRAPH_SLUG>` sends a build to Studio's staging environment. The resulting Studio endpoint is rate-limited and intended for testing, not production. Publishing is a separate onchain action that registers a version on the decentralized network. [Studio deployment](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/), [application endpoints](https://thegraph.com/docs/en/subgraphs/querying/from-an-application/)
- **Production is not keyless:** network gateway URLs require an API key.
- **Production is not unlimited/free:** 100,000 queries/month are free; excess queries require the Growth plan and card or GRT payment. [Querying overview](https://thegraph.com/docs/en/subgraphs/querying/introduction/)
- **A public endpoint is not instantly production-ready:** the deployment must sync, be healthy, and have indexers serving it. Signal helps attract additional indexers; merely obtaining a URL does not prove the desired availability.

## Concrete go-live procedure

### 1. Production preflight

- Confirm the production chain is on The Graph's current [supported-networks list](https://thegraph.com/docs/en/supported-networks/). If it is not supported, the decentralized-network path may not work; self-hosting Graph Node or another indexer becomes a separate infrastructure budget.
- Pin/review the Graph CLI version and run `graph codegen`, tests, and `graph build` in CI.
- Review `subgraph.yaml` production network, contract address, ABI, and `startBlock`. Set `startBlock` to the deployment block (or earliest event needed), not zero, to avoid needless sync time.
- Decide who owns the subgraph. Publishing creates an onchain subgraph NFT; use a team-controlled Arbitrum wallet/multisig, not an employee's personal wallet. Fund it with a small amount of ETH for Arbitrum gas. Keep the Studio deploy key in CI secrets.

### 2. Deploy to Studio (staging)

1. Connect the ownership wallet at [Subgraph Studio](https://thegraph.com/studio/), create the subgraph, and copy its deploy key.
2. Authenticate: `graph auth <DEPLOY_KEY>`.
3. Deploy: `graph deploy <SUBGRAPH_SLUG>` and give the build a meaningful version label, preferably semver.
4. Exercise the Studio URL, of the form `https://api.studio.thegraph.com/query/<ID>/<NAME>/<VERSION>`. Treat it as staging only.
5. Wait until indexing is healthy and caught up. Validate entity counts, representative marketplace queries, production addresses, `_meta` block/health behavior, and expected reorg/finality behavior. A local Graph Node passing tests does not validate the hosted network's data source or full historical sync.

Studio currently limits an account to **3 deployed, unpublished subgraphs**; old inactive versions are also subject to archival rules. Source: [Studio deployment documentation](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/). **Re-check before making this an operational constraint.**

### 3. Publish to The Graph Network

- In Studio, press **Publish** (or use the current CLI publishing flow). This is an onchain Arbitrum One transaction. Publishing is what makes the subgraph visible in Graph Explorer and available to indexers; it is not the same operation as the preceding Studio deploy.
- Record the immutable Subgraph ID, deployment/version, transaction, owner wallet, and rollback/update procedure.
- Wait for the production version to be indexed. In Graph Explorer, verify current deployment, sync status, query success, and the indexers serving it before cutting traffic over.

The required stand-up cost is **variable Arbitrum gas**, paid in ETH; The Graph does not quote a fixed dollar amount. Source: publishing is an onchain action in [the lifecycle docs](https://thegraph.com/docs/en/subgraphs/overview/) and current billing/protocol activity is on Arbitrum One in [billing docs](https://thegraph.com/docs/en/subgraphs/billing/). **Re-check live gas and the exact Studio transaction immediately before budgeting/publishing.** Budgeting a small gas contingency is more defensible than claiming `$0` or a fixed fee.

### 4. Decide on curation signal

Signal is GRT locked in the subgraph's curation pool to indicate demand and attract indexers. It is not payment for your own queries and is not recurring rent. The current publishing guide says the Sunrise Upgrade Indexer ensures all subgraphs are indexed, but recommends **at least 3,000 GRT** for an indexing-reward-eligible subgraph to attract additional indexers. Source: [publishing guide](https://thegraph.com/docs/en/subgraphs/developing/publishing/publishing-a-subgraph/).

Treat 3,000 GRT as **recommended reliability capital, not a mandatory fee**. Its USD value floats and most principal remains withdrawable, but signaling incurs a **1% curation tax** (burned); auto-migrating signal to a new version incurs a stated **0.5% tax**. Source: [curation docs](https://thegraph.com/docs/en/resources/roles/curating/). At 3,000 GRT, the initial 1% tax is **30 GRT**; the remaining roughly 2,970 GRT is locked/exposed capital rather than an expense in the same sense. There is also Arbitrum gas. **Re-check the recommended amount, tax, reward eligibility, GRT/USD price, and actual indexer count before approval.** If one Upgrade Indexer is insufficient for the dApp's reliability target, obtain/monitor multiple indexers rather than treating “published” as an SLA.

### 5. Production query access and billing

1. Create a production API key in Studio.
2. Restrict it to this subgraph and the production domain; set an explicit monthly USD spending limit and usage alerts. Use separate staging and production keys.
3. For stronger abuse control, send browser traffic through your backend/edge proxy and keep the key server-side. The Graph's FAQ also permits putting a domain- and subgraph-restricted key in a frontend, but a browser credential is inherently visible; restrictions and the spending cap are therefore essential. [API-key management](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/), [developer FAQ](https://thegraph.com/docs/en/subgraphs/developing/developer-faq/)
4. Upgrade to Growth and choose card or GRT billing before exceeding the free quota. Card invoices settle monthly. For crypto billing, deposit **GRT on Arbitrum** and hold **ETH on Arbitrum for deposit/withdrawal gas**. An insufficient balance can interrupt paid querying. [Billing docs](https://thegraph.com/docs/en/subgraphs/billing/)
5. Configure the production URL: `https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>`. Use POST, timeouts, retries with jitter, caching where correctness permits, pagination, and application monitoring.
6. Canary the gateway, compare responses to local/staging fixtures, then cut over. Alert on GraphQL/indexing errors, stale `_meta.block.number`, latency, query volume/spend, and indexer coverage. Keep a rollback route to the prior published version where the update model permits it.

## Budget

### Required/likely costs

| Item | Planning amount | Basis and caveat |
| --- | ---: | --- |
| Studio deploy/test | **$0** for ordinary use | Studio is the free testing environment; Free plan includes 100,000 monthly queries. [Studio docs](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/). Fair-use/storage limits apply; verify if the subgraph is large. |
| Publish/update transactions | **Variable Arbitrum ETH gas** | Onchain publish/update; no durable fixed USD quote. Re-check at execution. |
| Production queries, first 100,000/month | **$0** | Current Free-plan allowance. [Billing](https://thegraph.com/docs/en/subgraphs/billing/). Re-check before committing. |
| Production queries above allowance | Current public calculator implies **$2 per additional 100,000 queries** | The Graph's live product page currently displays **300,000 total queries = $4/month**, i.e. 100k free plus 200k paid. [Current pricing calculator](https://thegraph.com/subgraphs/). This is a derived unit rate, not a contractual quote; re-check the Studio estimator/terms. |

Using that displayed rate, and assuming simple linear pricing:

- **1 million total/month:** `(1,000,000 - 100,000) / 100,000 × $2 = $18/month`.
- **2 million total/month:** `$38/month`.
- **3 million total/month:** `$58/month`.
- **5 million total/month:** `$98/month`.

These are planning estimates derived from the current calculator, not guaranteed invoices. Query complexity, policy, pricing, taxes, and product terms can change. **Re-open the calculator and confirm the exact 2M/3M slider values on the day the budget is approved.** The Graph itself suggests **1M–2M queries/month** as an initial estimate for a small-to-medium app, then monitoring actual use. Source: [Billing FAQ](https://thegraph.com/docs/en/subgraphs/billing/).

### Optional/reliability capital

- **3,000 GRT signal:** recommended by current docs for an eligible subgraph to attract more indexers; not required monthly query spend. Budget its live USD market value as treasury capital, plus **30 GRT initial curation tax** at the documented 1% rate and Arbitrum gas. Do not book all 3,000 GRT as a consumed operating expense, but do account for price/liquidity/protocol risk.
- If choosing GRT rather than card for query billing, fund the billing balance for expected usage plus headroom. That GRT is consumed as queries are invoiced; also retain Arbitrum ETH for gas. Card billing avoids needing GRT for query payment, but it does not eliminate the publishing gas transaction.

## Reasoning behind the recommendation

“Works locally” proves mapping/schema behavior in one controlled Graph Node. Production adds four independent concerns: network registration, somebody actually indexing and staying synced, authenticated gateway access, and payment/abuse control. The draft collapses all four into an obsolete command and therefore misses both the operational readiness checks and every real cost boundary. The smallest credible launch is Studio staging + onchain publish + verified synced network deployment + restricted production API key + Growth billing. For a frontend the team says it can “rely on,” add spend/staleness monitoring and explicitly decide whether one default indexer is acceptable or whether 3,000-GRT-class signal and multiple indexers are warranted.
