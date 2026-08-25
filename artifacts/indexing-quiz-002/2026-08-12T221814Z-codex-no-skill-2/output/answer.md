# Production runbook: local Graph Node to The Graph Network

## Bottom line

The draft is obsolete. The Hosted Service stopped operating on **June 12, 2024**; `graph deploy --hosted-service marketplace` is not today's production path. The production product is the decentralized **Graph Network**, reached through The Graph gateway. The official sunset notice states both the shutdown date and that queries now run on the Network: [The Road to Sunsetting the Hosted Service](https://thegraph.com/blog/sunsetting-hosted-service/).

The real path is:

`local tests` → `Subgraph Studio deployment (staging)` → `publish onchain to Graph Network` → `wait for healthy/synced indexing` → `create and secure API key` → `configure billing` → `use gateway URL in production`

Deploying to Studio and publishing to the Network are separate operations. The former is staging; the latter is the production registration.

## Go-live steps

1. **Confirm Network compatibility.** Check that the chain and every subgraph feature/data source are supported by decentralized-network Indexers. If the chain is unsupported, the fallback is operating Graph Node infrastructure yourself, not the retired Hosted Service. Source: [Supported Networks](https://thegraph.com/docs/en/supported-networks/).

2. **Create the subgraph in Subgraph Studio.** Sign in with the team's wallet, create a Studio subgraph/slug, record ownership and recovery procedures, and obtain its deploy key. Prefer a team-controlled multisig for eventual production ownership; publication mints a subgraph NFT whose owner controls updates. Sources: [Studio deployment guide](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/) and [transferring ownership](https://thegraph.com/docs/en/subgraphs/developing/managing/transferring-a-subgraph/).

3. **Authenticate, build, and deploy to Studio.** With a current `@graphprotocol/graph-cli`:

   ```sh
   graph auth <DEPLOY_KEY>
   graph codegen
   graph build
   graph deploy <SUBGRAPH_SLUG>
   ```

   Some official examples spell the last command `graph deploy --studio <SUBGRAPH_SLUG>`; use the syntax shown by the pinned CLI version in CI. Give the deployment an immutable, meaningful version label (for example, the release semver plus commit SHA). Do not put the deploy key in source control.

   This uploads a version to **Studio only**. It does not publish it to the decentralized Network. Studio's development query URL is for staging and is capped at **3,000 queries/day**, so it is not the production endpoint. Source for commands, distinction, and cap: [Studio deployment guide](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/).

4. **Validate the Studio deployment.** Wait for it to reach chain head; verify `health`, `synced`, latest indexed block, logs, deterministic errors, start block, and representative queries against known chain data. Exercise the actual frontend query set and measure latency. Do not cut over merely because upload succeeded. The status fields and sync checks are described in [Deploying to Multiple Networks / Checking Subgraph Health](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/multiple-networks/).

5. **Publish the validated version to the Graph Network.** Use Studio's **Publish** action, approve the wallet transaction, and complete metadata; alternatively, current CLI supports `graph codegen && graph build && graph publish`. Publication is an onchain action (normally on The Graph's protocol network, Arbitrum One) and makes the subgraph visible in Graph Explorer so Indexers can index it. It is not the same as `graph deploy`. Sources: [Publishing a Subgraph](https://thegraph.com/docs/en/subgraphs/developing/publishing/publishing-a-subgraph/) and [Subgraph lifecycle](https://thegraph.com/docs/en/subgraphs/overview/).

6. **Ensure it is actually served.** Publication alone does not guarantee adequate production supply. Inspect Graph Explorer for the current deployment, indexing progress, Indexers/allocations, query success, and latency. The docs say published subgraphs are unlikely to be picked up by additional Indexers without **curation signal**; signal is GRT locked on the subgraph to advertise demand. The Sunrise Upgrade Indexer currently ensures indexing of all subgraphs, while more signal can attract more Indexers and improve availability. Sources: [Subgraph lifecycle](https://thegraph.com/docs/en/subgraphs/overview/) and [Curating](https://thegraph.com/docs/en/resources/roles/curating/). For a relied-upon endpoint, define a readiness gate (healthy, at chain head, successful smoke tests, acceptable latency, and satisfactory Indexer coverage) rather than assuming immediate readiness.

7. **Create a production API key and billing plan.** A Network query URL requires an API key. Create a separate production key in Studio, restrict it to this subgraph and the frontend's allowed domains, set a monthly USD spending limit, and monitor usage. Prefer the `Authorization: Bearer <API_KEY>` form where a backend/proxy can keep it secret; a browser key is necessarily visible, so domain/subgraph restrictions and spend limits are essential. Source, including URL/header forms and controls: [Manage API Keys](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/).

8. **Cut the frontend over to the Network gateway URL.** Copy the unique production URL from Graph Explorer. Its documented form is:

   ```text
   https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
   ```

   or omit the key from the path and send it as a bearer token. Use the immutable subgraph ID supplied by Explorer, not the old Hosted Service name URL. Smoke-test from every allowed production origin, then monitor query count/cost, errors, latency, health, and indexed-block lag. Sources: [How to Query a Subgraph](https://thegraph.com/docs/en/subgraphs/querying/introduction/) and [Manage API Keys](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/).

9. **Treat upgrades as releases.** Deploy each candidate version privately to Studio, validate it, then publish the new version onchain. Watch sync and query behavior before declaring it live. Auto-migrated curation signal incurs a tax, noted below. Keep rollback/version procedures and alerting in the runbook.

## Budget

### Standing it up

- **Studio deployment/testing: $0 service charge.** It is a staging facility, with the 3,000-query/day development limit above. Source: [Studio guide](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/).
- **Publishing: variable Arbitrum gas in ETH.** Publishing is an onchain transaction; therefore budget ETH on Arbitrum for publication and later onchain updates. There is no defensible fixed USD figure: gas and ETH/USD move. **Re-check in the Studio wallet confirmation immediately before budgeting/release.** Source for publication being onchain and the default protocol network being Arbitrum One: [Publishing a Subgraph](https://thegraph.com/docs/en/subgraphs/developing/publishing/publishing-a-subgraph/).
- **Curation signal: optional locked GRT, but operationally relevant.** The docs do not give a universal minimum. Amount signaled is capital locked, not a monthly hosting fee, and can be withdrawn; signaling burns a **1% curation tax**. Auto-migrating signal to a new version incurs a **0.5% tax** according to the current curation page. Gas also applies. Choose the signal amount from current Indexer coverage/Studio guidance; do not put an old “10,000 GRT minimum” into the budget. **Re-check the chosen GRT amount, GRT/USD, tax parameters, and gas at execution.** Source: [Curating—risks and update costs](https://thegraph.com/docs/en/resources/roles/curating/).
- **GRT is not required merely because queries are paid.** Query bills may be paid by credit/debit card instead. GRT is required only if the team chooses GRT billing or chooses to curate/signal. If using GRT billing, funding the billing balance from Arbitrum requires GRT plus ETH for gas; the docs say the allowance transaction itself costs no gas but adding the balance does. Source: [Billing](https://thegraph.com/docs/en/subgraphs/billing/).

### Monthly query cost

The current plans provide **100,000 queries per month free**. Above that, the Growth Plan is usage-based and can be paid by card or GRT. Sources: [Billing](https://thegraph.com/docs/en/subgraphs/billing/) and [querying introduction](https://thegraph.com/docs/en/subgraphs/querying/introduction/).

The current public pricing calculator displays **300,000 monthly queries = $4** after the free 100,000. That implies the present calculator rate is **$20 per additional million queries** (`$4 / 200,000 × 1,000,000`). Source: [The Graph Subgraphs pricing calculator](https://thegraph.com/subgraphs/), accessed **2026-08-12**.

Using that displayed rate:

| Total monthly queries | Paid queries after 100k | Estimated monthly bill |
| ---: | ---: | ---: |
| 2,000,000 | 1,900,000 | **$38** |
| 3,000,000 | 2,900,000 | **$58** |
| 5,000,000 | 4,900,000 | **$98** |

Reasoning: `max(queries - 100,000, 0) × $20 / 1,000,000`. This excludes optional curation capital/taxes and gas.

**Re-check this entire rate table before committing the budget.** The billing docs deliberately describe usage pricing without promising a fixed rate, and older official material quoted both $40/million and $20/million at different times. The live calculator is the best current public figure, but pricing, free allowance, taxes, and GRT/USD can change. Confirm in Studio's billing estimator, save a dated screenshot/export, and budget headroom for traffic growth/retries. Also verify what Studio counts as a billable query for batched requests in the current terms rather than estimating from page views.

## What the teammate's sentence gets wrong

- `--hosted-service` targets a retired service, not today's production route.
- Studio **deployment** is staging; Network **publication** is the production onchain step.
- Production queries require an API key; “no tokens” confuses API credentials with GRT. The API key is mandatory. GRT itself is avoidable for query billing if paying by card, but ETH is needed for publication gas and GRT is needed if signaling or choosing GRT billing.
- The service is free only through 100,000 Network queries/month. A few million queries are paid usage.
- A query endpoint is not production-ready “straight away”: the published deployment must be indexed, healthy, caught up, and adequately served before cutover.
- Reliability still needs operational controls: restricted keys, spending caps, health/lag/error/latency monitoring, versioned releases, smoke tests, and a rollback plan.
