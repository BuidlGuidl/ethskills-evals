# Shipping the marketplace subgraph to production

**Short version:** the draft ship step cannot work. The Graph's hosted service was
shut down on **June 12, 2024** — there is no `--hosted-service` target to deploy to,
no free public endpoint at the other end of it, and the "no tokens, no billing"
claim is wrong on both counts. The real path is **Subgraph Studio → publish onchain
to The Graph Network (Arbitrum One) → query through the gateway with an API key**.
It costs a small one-time onchain outlay plus roughly **$58/month at 3M queries**
(current list price), and it involves two different kinds of "token" your teammate's
draft assumes away: an API key, and GRT.

Every figure below has a source and a re-check flag. Skip to
[§5 Numbers to re-check](#5-numbers-to-re-check-before-you-commit-the-budget-line)
for the budget-line summary.

---

## 1. What the draft step gets wrong

| Draft claim | Reality |
|---|---|
| `graph deploy --hosted-service marketplace` | The hosted service was sunset in phases from Q3 2022 and, per The Graph's own post, **"As of June 12th, 2024, the hosted service is no longer active. All queries are now powered by The Graph Network."** New deploys to it stopped in **Q3 2022**. Even if an old pinned `graph-cli` in your `package.json` still accepts the flag, there is no live endpoint behind it. (Verify locally with `npx graph deploy --help` — I did not run your CLI.) |
| "The hosted service is free" | Gone, so not applicable. Its replacement is free only up to **100,000 queries/month**; past that it is usage-billed. |
| "…gives us a public GraphQL endpoint our frontend can hit straight away" | Deploying to Studio gives you a **development** endpoint that is explicitly *"free to use, rate-limited, not visible to the public, and meant to be used for development, staging, and testing purposes."* It is not a production endpoint. You get a production endpoint only after a separate **onchain publish** step. |
| "no tokens" | Two tokens are unavoidable: (a) an **API key** — the production gateway URL will not answer without one; (b) **ETH on Arbitrum One** for publish gas. A third, **GRT**, is strongly recommended (curation signal) and is one of the two ways to pay the query bill. |
| "nothing to set up" | You need: a wallet that will own the subgraph onchain, ETH on Arbitrum, a card or GRT balance on file for billing, an API key with domain/subgraph restrictions and a spend cap, and a decision about whether the key ships in your frontend bundle or sits behind a proxy. |

The one thing the draft gets right: the **build and deploy commands are still `graph`
CLI commands**, and your locally-tested mappings deploy unchanged. Nothing about your
subgraph code has to change. What changes is everything after `graph deploy`.

---

## 2. The real go-live path

### Step 0 — Pre-flight (do this before the sprint starts)

1. **Confirm your chain is served by the decentralized network, not just Studio.**
   The supported-networks table distinguishes *Hosted (No issuance)* from
   *The Graph Network (Issuance)*. A chain can be indexable in Studio yet have thin
   or no indexer coverage on the network. If your marketplace is on a mainstream
   L1/L2 this is a formality; check it anyway, because it is the one failure mode
   that invalidates the whole plan.
   → https://thegraph.com/docs/en/supported-networks/
2. **Check your subgraph doesn't use a feature the network won't serve.** The
   feature-support matrix is the authority (e.g. full-text search and grafting have
   had caveats).
   → https://github.com/graphprotocol/indexer/blob/main/docs/feature-support-matrix.md
3. **Decide which wallet owns the subgraph.** Publishing is an onchain action; the
   publishing address owns the subgraph NFT and is the only one that can publish new
   versions. Use a team-controlled wallet (ideally a multisig), not a personal
   dev key. This is a genuine key-management item for the runbook — losing it means
   losing the ability to ship updates to that subgraph ID.

### Step 1 — Deploy to Subgraph Studio (free)

Create the subgraph in Studio, grab the deploy key from its page, then:

```bash
graph codegen && graph build
graph auth <DEPLOY_KEY>
graph deploy <SUBGRAPH_SLUG>
```

Studio indexes it and gives you a development query URL. Use this for staging.
It is rate-limited and non-public; do not point production at it.
→ https://thegraph.com/docs/en/subgraphs/quick-start/

### Step 2 — Verify in Studio, then publish onchain

In the Studio dashboard, wait for the subgraph to reach 100% synced and check for
indexing errors. Then hit **Publish**, and select **Arbitrum One** as the network to
publish to (`arbitrum-sepolia` exists if you want a dress rehearsal). This is a
transaction from your owning wallet, so that wallet needs **ETH on Arbitrum One**.

Note this is *where the subgraph is registered*, independent of which chain your
marketplace contracts live on — the registry itself lives on Arbitrum One. The docs
are explicit that if the subgraph isn't already published anywhere, you should
publish directly on Arbitrum One because the gas is dramatically cheaper than
Ethereum mainnet.

→ https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/

**Indexing lead time:** near zero, in practice. The Edge & Node "upgrade indexer"
pre-syncs subgraphs deployed to Studio, so *"when a subgraph is fully indexed in
Subgraph Studio, it will also be fully indexed the second it is published."* Treat
this as a convenience, not a guarantee — it is described as an "as needed" fallback
until at least three other indexers reach sufficient service quality on your
subgraph. Budget a verification window in the runbook rather than assuming instant
production-grade redundancy.
→ https://thegraph.com/docs/en/subgraphs/upgrade-indexer/

### Step 3 — Signal curation on your own subgraph (recommended, not required)

The docs: *"it is recommended that you curate your own Subgraph with at least
**3,000 GRT** in order to attract additional indexers."* Curation is genuinely
optional — indexers may serve an unsignaled subgraph — but signal is the mechanism
that gets *independent* indexers to allocate to you. Without it you are
substantially relying on the upgrade indexer, which is a single point of failure and
explicitly a stopgap. For something the frontend "can rely on," signal.

Costs attached to signalling:
- **1% curation tax** on the GRT you signal (burned, not recoverable).
- **0.5%** additional tax when signal auto-migrates to a new subgraph version — i.e.
  you pay this again, at half rate, each time you ship a subgraph update with
  auto-migration on.
- The principal is **recoverable but not principal-protected**: signal sits on a
  bonding curve, so what you get back on withdrawal depends on curve position when
  other curators enter/exit. Treat the 3,000 GRT as at-risk capital, not a deposit.

→ https://thegraph.com/docs/en/resources/roles/curating/

### Step 4 — Set up billing before you flip traffic over

In Studio's billing page, either put a **credit card** on file or deposit **GRT on
Arbitrum One**. Invoices process at the end of each month; anything beyond the free
100k/month requires one of the two to be in place. GRT deposited from Arbitrum
clears in moments; GRT bridged from Ethereum mainnet takes ~15–20 minutes and needs
ETH on Arbitrum for gas. Unused GRT is withdrawable at any time.

→ https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/

**Runbook trap:** if you go live without billing configured and cross 100k queries,
you are relying on a hard cutoff or a failed invoice at exactly the moment your
frontend is busiest. Fund it *before* the cutover, not after.

### Step 5 — Create and lock down the API key

Studio → **API Keys** → **Create API Key**. Then, on the key's Details page under
**Security**:
- **Add Domain** — allowlist the origins allowed to use the key.
- **Assign Subgraphs** — restrict the key to this subgraph only.
- Set a **monthly spending limit in USD**. Do this on day one; it is your only hard
  stop against a runaway bill.

Production query URL:

```
https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
```

or, better, keep the key out of URLs (and therefore out of proxy logs, browser
history, and referrer headers) by using the header form:

```
Authorization: Bearer <API_KEY>
```

The docs are blunt: *"Always keep your API key in environment variables or a secure
secrets manager. Do not hardcode it."*

→ https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/

**The uncomfortable part your runbook has to address:** a browser dApp querying the
gateway directly *ships the API key to every visitor*, no matter how carefully you
env-var it — it ends up in the JS bundle. Domain allowlisting mitigates casual abuse
but is enforced on a request header a determined caller can set arbitrarily. Two
options:

- **Ship the key client-side** with domain allowlist + subgraph assignment + a
  monthly spend cap. Cheap, standard practice for dApps, and the spend cap bounds
  your worst case to a number you chose. Accept that the cap is the real control.
- **Proxy through your own backend** (edge function / API route), key server-side,
  your own rate limiting per user or IP. Costs you a service to run and adds a hop
  of latency, but the key is never exposed and you get per-user quotas.

Pick one deliberately and write it into the runbook. If your frontend is fully static
with no backend, option 1 with a tight spend cap is the pragmatic call.

### Step 6 — Cut over and verify

Point the frontend at the gateway URL. Verify: query results match the Studio
endpoint, latency is acceptable from your users' regions, and error handling covers
gateway 4xx/5xx (this is a network of independent indexers — transient errors are a
normal condition, not an incident). Watch the Studio Overview panel for query
volume, GRT spent, and rate-limit hits for the first week and true up the budget.

### Step 7 — Know the update path (it's not free)

Shipping a subgraph change later means: `graph deploy` to Studio (free), then a
**new onchain publish** (gas again) to release the version. Curators auto-migrating
pay the 0.5% tax. Anything requiring a full re-index means the new version syncs
from scratch before it can serve — plan for a period where the published version and
the new deployment disagree, and don't schedule subgraph migrations on the same day
as a contract migration.

---

## 3. Cost to stand up (one-time)

| Item | Cost | Source / basis | Confidence |
|---|---|---|---|
| Studio account + deploy | **$0** | Quick Start: Studio deploys are "free to use, rate-limited" | High |
| Publish transaction (Arbitrum One gas) | **ETH — docs give no figure** | Docs state only that Arbitrum gas is "considerably lower" than mainnet; no published number | **Low — see below** |
| Self-curation signal | **3,000 GRT recommended** ≈ **$38–$52** at GRT $0.0127–$0.0174 | Publishing docs (3,000 GRT); price from CoinDesk/CoinGecko/CoinMarketCap snapshots ~Aug 6 2026 | **Signal amount: high. USD conversion: low** |
| Curation tax (1% of signal) | **30 GRT** ≈ **$0.40–$0.52**, non-recoverable | Curating docs, 1% standard tax | High |
| GRT acquisition + bridging | Exchange fees + bridge gas | Not published; depends on your route | Low |

**Practical stand-up budget: fund the publishing wallet with ~$50 of ETH on Arbitrum
and ~3,050 GRT.** The ETH figure is a working buffer, not a measured cost — I could
not find a published gas number for the publish call, and I did not simulate the
transaction. Arbitrum L2 fees for a contract call of this shape are normally cents to
low single-digit dollars, so ~$50 is comfortable headroom that also covers the
billing deposit tx and a couple of future re-publishes. **Verify by simulating the
publish on `arbitrum-sepolia` first** — that also rehearses the whole Step 2 for the
runbook, which is worth the time regardless.

Note that ~3,000 GRT of the stand-up cost is **recoverable capital, not spend** —
minus the 1% tax and whatever the bonding curve does. Your finance people may want it
booked differently from the query bill.

---

## 4. Cost to run (per month)

List price: **first 100,000 queries/month free, then $2 per 100,000 queries**
(= $0.00002/query). The pricing page's own worked example — 300,000 queries = $4 —
confirms the free tier is subtracted before billing, not a credit against it.
→ https://thegraph.com/studio-pricing/

| Monthly queries | Billable (after free 100k) | Monthly cost |
|---|---|---|
| 100,000 | 0 | **$0** |
| 1,000,000 | 900,000 | **$18** |
| 3,000,000 | 2,900,000 | **$58** |
| 5,000,000 | 4,900,000 | **$98** |
| 10,000,000 | 9,900,000 | **$198** |

**At "a few million queries," budget $58–$98/month.** No subscription fee, no monthly
minimum, no per-subgraph fee — the pricing page emphasizes unlimited subgraphs and
usage-based billing only.

Two things that will move this number more than the rate will:

- **Query volume is a design output, not a fixed constant.** An un-memoized React
  component re-querying on every render, or a list view issuing one query per row
  instead of one batched query, can move you an order of magnitude at identical user
  traffic. Before committing a budget line, instrument the frontend and count actual
  gateway calls per session, then multiply by expected sessions. Guessing at query
  volume is the single largest error term here — larger than the GRT price, larger
  than the rate.
- **Client-side caching.** Apollo/urql normalized caching and sensible polling
  intervals routinely cut gateway calls substantially. If the budget is tight, this
  is the lever, not the pricing tier.

---

## 5. Numbers to re-check before you commit the budget line

Ranked by how much damage a stale value does.

| # | Figure | Value used | Why re-check | Where to check |
|---|---|---|---|---|
| 1 | **Your actual query volume** | assumed 3M/mo | Entirely your own; the only input that can be off by 10× | Instrument the frontend; then Studio → Overview after a week live |
| 2 | **$2 per 100,000 queries** | $2/100k | **This rate has changed before** — the widely-circulated figure was $4/100k; today's pricing page says $2/100k. It is a list price the vendor can revise | https://thegraph.com/studio-pricing/ |
| 3 | **GRT price for the 3,000 GRT signal** | $0.0127–$0.0174 (≈$38–$52) | Sources I saw disagreed with each other and the freshest was ~13 days old (Aug 6, 2026) at time of writing. Volatile by nature. Formula: `USD = 3,000 × GRT_price` | https://www.coingecko.com/en/coins/the-graph or https://coinmarketcap.com/currencies/the-graph/ |
| 4 | **Publish gas on Arbitrum** | ~$50 buffer, unmeasured | I found no published figure; my estimate, not a source. Depends on Arbitrum congestion at publish time | Simulate on `arbitrum-sepolia`, or check https://arbiscan.io/gastracker |
| 5 | **3,000 GRT recommended signal** | 3,000 GRT | Docs call it a recommendation; the amount that actually attracts indexers depends on competition for indexer attention on your chain | https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/ |
| 6 | **100,000 free queries scope** | assumed per account | Docs say "100,000 free monthly queries" but I did not confirm whether that is per account, per API key, or per subgraph. Matters if you later run staging + prod keys | https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/ |
| 7 | **Free-plan rate limits** | unknown | Docs confirm rate limits exist and that publishing "removes rate limits," but give no numbers for burst traffic | Studio → API key Details, and load-test before launch |
| 8 | **The CLI flag** | assumed removed | I did not run your CLI. Confirm the draft command actually fails rather than silently doing something odd | `npx graph deploy --help` in your repo |

Items 1–3 are the ones that move the budget line. Items 4–8 are runbook-correctness
items that will cost you an afternoon, not money.

---

## 6. Alternatives worth one line each

You are not locked into The Graph Network, and if the runbook's real requirement is
"an endpoint we control with predictable cost," two other shapes exist:

- **Self-host Graph Node.** You already run one locally. Production means a Postgres,
  an archive-node RPC provider, and someone on call. Cost moves from ~$58/month of
  query fees to server + RPC + engineering time — almost certainly *more* expensive
  than $58/month all-in, but fully under your control and with no third-party key.
- **Managed subgraph hosts** (Alchemy Subgraphs, Goldsky, and others) serve the same
  subgraph artifact with conventional SaaS billing and no onchain step. I have not
  verified their current pricing and am not quoting numbers — if the team wants a
  comparison, that is a separate check.

For a marketplace dApp at a few million queries a month, publishing to The Graph
Network is the standard path and the cheapest by a wide margin. The recommendation is
to go with it — just with billing funded, a spend cap set, and the API-key exposure
decision made explicitly rather than by default.

---

## Sources

- [The Road to Sunsetting the Hosted Service](https://thegraph.com/blog/sunsetting-hosted-service/) — sunset phases; "As of June 12th, 2024, the hosted service is no longer active."
- [Quick Start](https://thegraph.com/docs/en/subgraphs/quick-start/) — `graph auth` / `graph deploy`; Studio endpoint is "rate-limited, not visible to the public"; 100,000 free queries/month post-publish
- [Publishing a Subgraph to the Decentralized Network](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/) — Arbitrum One / arbitrum-sepolia; "at least 3,000 GRT"; publish directly on Arbitrum for lower gas
- [Subgraph Studio Pricing](https://thegraph.com/studio-pricing/) — 100k free/month; $2 per 100k; 300k = $4 worked example
- [Subgraph Studio (billing)](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/) — Free vs Growth plan; card or GRT; end-of-month invoicing; Arbitrum vs Ethereum deposit timing; withdrawal
- [How to Manage API keys](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/) — key creation, domain allowlist, subgraph assignment, USD spend limits, gateway URL format, "Do not hardcode it"
- [Curating](https://thegraph.com/docs/en/resources/roles/curating/) — 1% curation tax, 0.5% migration tax, bonding-curve risk, indexing without signal
- [Edge & Node Upgrade Indexer](https://thegraph.com/docs/en/subgraphs/upgrade-indexer/) — pre-syncs Studio deployments; "as needed" fallback until 3+ indexers reach service quality
- [Supported Networks](https://thegraph.com/docs/en/supported-networks/) — Studio vs network (issuance) distinction
- [Feature support matrix](https://github.com/graphprotocol/indexer/blob/main/docs/feature-support-matrix.md) — which subgraph features the network serves
- GRT spot price: [CoinGecko](https://www.coingecko.com/en/coins/the-graph), [CoinMarketCap](https://coinmarketcap.com/currencies/the-graph/), [CoinDesk](https://www.coindesk.com/price/the-graph) — snapshots around Aug 6, 2026, $0.0127–$0.0174, mutually inconsistent; re-check live

*Compiled 2026-08-19. Pricing and token figures are point-in-time; §5 lists what to
re-verify.*
