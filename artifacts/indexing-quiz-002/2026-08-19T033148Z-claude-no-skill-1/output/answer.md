# Shipping the marketplace subgraph to production on The Graph

**Written 2026-08-19.** Every figure below has a source and a "re-check?" flag. Anything
priced in GRT or gas is a moving number — treat the USD conversions as a snapshot, not a
budget constant.

---

## 1. What the draft runbook gets wrong

The draft is one sentence, and essentially all of it is stale. Six separate problems:

**1. The hosted service no longer exists.** It was shut down on **12 June 2024**. There is
nothing to deploy to. This isn't "deprecated but working" — the endpoints are gone.
> Source: [The Graph — "The Road to Sunsetting the Hosted Service"](https://thegraph.com/blog/sunsetting-hosted-service/),
> and [The Graph — "The Sunrise of Decentralized Data"](https://thegraph.com/blog/transitioning-to-decentralized-graph-network/).
> Third-party confirmation: [Alchemy](https://www.alchemy.com/blog/sunsetting-the-graphs-hosted-service),
> [SubQuery](https://blog.subquery.network/graphs-hosted-service-is-sunset-deploy-your-subgraph-to-subquerys-managed-service-today/).

**2. The flag is wrong even historically.** It was never `--hosted-service`; it was
`--product hosted-service`. Neither exists today. I checked the current CLI directly:

```
$ npx @graphprotocol/graph-cli@0.98.1 deploy --help
USAGE
  $ graph deploy [SUBGRAPH-NAME] [SUBGRAPH-MANIFEST] [-h] [-g <value>]
    [--deploy-key <value> | --access-token <value>] [-l <value>] [-i <value>]
    [--ipfs-hash <value>] [--headers <value>] [--debug-fork <value>] [-o <value>]
    [--skip-migrations] [-w] [--network <value>] [--network-file <value>]
```
No `--product`, no `--hosted-service`. The command in the draft dies at argument parsing.
> Source: ran locally against `@graphprotocol/graph-cli@0.98.1` (latest on npm, published
> 2026-08-18 per `npm view @graphprotocol/graph-cli version time.modified`).

**3. `graph deploy` on its own doesn't get you to production.** It gets you into **Subgraph
Studio**, which the docs describe as: *"free to use, rate-limited, not visible to the
public, and meant to be used for development, staging, and testing purposes."* The Studio
query URL (`https://api.studio.thegraph.com/query/<ID>/<NAME>/<VERSION>`) is *"intended for
testing purposes **only** and is rate-limited."* Pointing a production frontend at it is the
single most common way teams ship a subgraph that falls over on launch day.
> Source: [Quick Start](https://thegraph.com/docs/en/subgraphs/quick-start/),
> [Querying from an Application](https://thegraph.com/docs/en/subgraphs/querying/from-an-application/).

**4. "No tokens" is wrong.** Going live touches two tokens:
   - **ETH on Arbitrum One** — to pay gas for the publish transaction. Publishing happens
     on-chain on Arbitrum One (the CLI's `--protocol-network` defaults to `arbitrum-one`).
   - **GRT** — for the recommended self-curation signal, and optionally for query billing
     (though you can pay by card instead — see §4).
> Source: [Publishing a Subgraph](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/);
> `graph publish --help` on CLI 0.98.1 shows `--protocol-network=arbitrum-one|arbitrum-sepolia`, default `arbitrum-one`.

**5. "No billing" is wrong past 100K queries/month.** Free tier is 100,000 queries/month;
after that it's metered. At "a few million queries" you are firmly in paid territory (§4).

**6. "A public GraphQL endpoint our frontend can hit straight away" is wrong twice over.**
   - The production gateway endpoint **requires an API key**, and the docs say explicitly:
     *"Always keep your API key in environment variables or a secure secrets manager. Do not
     hardcode it in your codebase or **expose it in client-side apps**."* So a browser
     frontend cannot just "hit it straight away" — see §5.
   - "Straight away" ignores **indexer sync time**. After publishing, indexers have to pick
     up your subgraph and sync it from your `startBlock`. Until at least one is synced to
     chainhead, the endpoint returns stale data or errors.
> Source: [Managing API Keys](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/).

---

## 2. The actual go-live path

Seven steps. Steps 3–5 are the ones the draft collapses into nothing.

### Step 0 — Prereqs (do this before the sprint starts)
- A wallet that will **own** the subgraph on Arbitrum One. Publishing mints on-chain
  ownership; whoever holds that key controls future version publishes. **Use a multisig or
  a dedicated deploy safe, not someone's personal MetaMask.** This is a real operational
  risk item for the runbook — losing that key means you can never publish an update.
- That wallet funded with **ETH on Arbitrum One** (gas) and, if you're signalling,
  **GRT on Arbitrum One**. GRT is accepted on Ethereum mainnet too but you'll still need
  ETH on Arbitrum for gas.
- Confirm your marketplace's chain is supported on the **decentralized network** (not just
  in Studio). Some chains are Studio-only and can't be published for indexing rewards.
  Check the [Supported Networks](https://thegraph.com/docs/en/supported-networks/) table
  before you commit the sprint — this is a hard blocker if it's wrong.

### Step 1 — Create the subgraph in Subgraph Studio
At [thegraph.com/studio](https://thegraph.com/studio), connect the deploy wallet, create the
subgraph, copy the **deploy key**. This is a Studio API credential, not a blockchain key.

```bash
graph auth <DEPLOY_KEY>
```

### Step 2 — Deploy to Studio (staging)
```bash
graph codegen && graph build
graph deploy <SUBGRAPH_SLUG>
```
Use `-l / --version-label` to tag the version so your runbook can reference it.
This is **free and rate-limited**. Verify here that it syncs against the real chain (not
just your local Graph Node) and that your queries return what you expect. Your local Graph
Node testing does *not* cover reorg handling, real RPC flakiness, or real historical volume.

### Step 3 — Publish to the network (on-chain, costs gas)
```bash
graph publish
```
This opens a web UI to connect the wallet, add metadata, and send the publish transaction
to **Arbitrum One**. Alternatively use the Publish button in the Studio dashboard.
After this the subgraph is visible in Graph Explorer and indexers can index it.

### Step 4 — Signal curation (GRT, recommended)
The docs are blunt about this: *"Published Subgraphs are unlikely to be picked up by
Indexers without curation signal."* And: *"If your Subgraph is eligible for rewards, it is
recommended that you curate your own Subgraph with at least 3,000 GRT in order to attract
additional indexers to index your Subgraph."*

This is **not a fee** — signal is recoverable GRT you can withdraw at any time, minus tax.
Budget it as at-risk working capital, not opex. See §4 for the numbers and the caveats.

### Step 5 — Wait for indexers, then verify
Watch Graph Explorer for indexer count and sync progress. **Do not cut the frontend over
until at least one indexer (ideally 2–3, for redundancy) is synced to chainhead.** Verify
with a `_meta` query against the gateway:
```graphql
{ _meta { block { number } hasIndexingErrors } }
```
Compare `block.number` against chainhead. This same query is your production health check.

### Step 6 — API key, locked down
In Studio → API Keys → Create API Key. Then, in the key's Security section:
- **Add Domain** — allowlist only your production domains.
- **Assign Subgraphs** — restrict the key to this subgraph only.
- **Manage spending limit** — set a monthly USD cap. Do this on day one; it's your only
  protection against a runaway loop or an abusive client burning your balance.

Production endpoint:
```
https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
```
or, preferred, key in a header:
```
Authorization: Bearer <API_KEY>
```
against `https://gateway.thegraph.com/api/subgraphs/id/<SUBGRAPH_ID>`.

### Step 7 — Cut over the frontend
See §5 — the key handling determines your architecture here, so decide it before step 6.

**Updating later:** `graph deploy` a new version to Studio, verify, then publish the update
(another Arbitrum transaction, more gas). Curation signal auto-migrates to the new version
and incurs a **0.5% migration tax**. Budget a few dollars of ETH per release, forever.

---

## 3. Reasoning: why this shape

The mental model that makes the rest obvious: **The Graph today is two products stapled
together, and "deploy" only touches the first one.**

- **Subgraph Studio** is the centralized dev sandbox. Free, private, rate-limited, no chain
  involvement. `graph deploy` targets this.
- **The Graph Network** is the decentralized production system. Getting on it requires an
  **on-chain publish** (hence gas, hence a wallet, hence tokens), independent indexers who
  need an economic reason to index you (hence curation signal), and metered paid queries
  through a gateway (hence an API key, hence billing).

The old hosted service was a third thing that behaved the way the draft describes — free,
public, no wallet, no key. That's exactly why the draft reads plausibly. It's describing a
product that was switched off two years ago. Everything the draft is missing is a
consequence of the network being decentralized: someone other than you runs the index, so
they must be paid and incentivized, and payment requires identity (the API key) and a
balance.

So the cost structure splits cleanly into three buckets, and I'll price them separately:
**(a) one-time gas**, **(b) recoverable capital locked as signal**, **(c) recurring
per-query opex**. The draft assumed all three were zero. Only (a) is close to zero.

---

## 4. What it costs

### Snapshot prices used for conversions (re-check all of these)

| Input | Value | Source | Re-check? |
|---|---|---|---|
| GRT / USD | **$0.01308** | CoinGecko API, 2026-08-19. Cross-checked: Coinbase $0.0130515, Binance GRTUSDT $0.01306 | **YES — before every budget review** |
| ETH / USD | **$1,910.72** | CoinGecko API, 2026-08-19 | **YES** |
| Arbitrum One gas price | **0.02 gwei** (`eth_gasPrice` = 20,000,000 wei) | `arb1.arbitrum.io/rpc`, block 496,401,996, 2026-08-19 | **YES — spiky** |

### (a) One-time: standing it up

| Item | Cost | Source | Re-check? |
|---|---|---|---|
| Studio account + deploy key | **$0** | [Studio pricing](https://thegraph.com/studio-pricing/) | No |
| Deploy to Studio (staging) | **$0** (rate-limited) | [Quick Start](https://thegraph.com/docs/en/subgraphs/quick-start/) | No |
| Publish tx gas on Arbitrum One | **~$0.04, call it well under $1** | My estimate: ~1M gas × 0.02 gwei = 2×10⁻⁵ ETH ≈ $0.04 at $1,910/ETH | **YES — this is my own estimate, not a documented figure.** Gas units for `publishNewSubgraph` are unverified; I assumed a generous 1M. Arbitrum L1 data fees are extra but small for this calldata |
| Token approvals (GRT spend approval) | 1–2 more txs, same order | Same estimate basis | **YES** |
| **ETH float to keep on the deploy wallet** | **$50** recommended | My recommendation — covers publish plus ~years of version-update txs with huge headroom | Judgement call, not a quoted price |

**One-time hard cost: effectively under $5, and $50 of ETH parked on the wallet.**
The gas here is genuinely negligible at current Arbitrum prices. Don't let anyone tell you
publishing is expensive — the expensive-sounding part is the signal, which isn't a cost.

### (b) One-time: curation signal (recoverable capital, not a fee)

| Item | Amount | USD @ $0.01308 | Source | Re-check? |
|---|---|---|---|---|
| Recommended self-signal | **3,000 GRT** | **$39.26** | [Publishing docs](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/), verbatim: *"at least 3,000 GRT"* | **YES — both the 3,000 figure and the GRT price** |
| Curation tax on entry (burned, unrecoverable) | 1% = 30 GRT | **$0.39** | [Curating docs](https://thegraph.com/docs/en/resources/roles/curating/): *"Upon initial curation, a 1% standard tax is incurred"* | Moderate |
| Migration tax per version update | 0.5% | ~$0.20 per release | Same page: *"a 0.5% curation tax on every migration"* | Moderate |

**Four caveats you need before this goes in the budget:**

1. **$39 is startlingly cheap because GRT is at ~$0.0131.** The recommendation is a *fixed
   token amount*, so the USD cost floats entirely with GRT price. If GRT 5×'s, this line
   becomes ~$200. Budget the token amount, not the dollar amount.
2. **3,000 GRT is a floor for attracting indexers, not a guarantee.** The docs say "at
   least," and it's framed as attracting *additional* indexers. For a production marketplace
   where downtime is user-visible, I'd plan to **watch indexer count after publishing and be
   ready to add more signal** if you only attract one or zero. Put a decision point in the
   runbook rather than a fixed number.
3. **The recommendation is conditioned on rewards eligibility** — *"If your Subgraph is
   eligible for rewards."* Confirm your chain is rewards-eligible on the Supported Networks
   page; if it isn't, the signal calculus changes and you should ask in the Graph forum
   before spending.
4. **Signal is withdrawable at any time with no cooldown**, but it's exposed to GRT price
   and to bonding-curve dynamics on withdrawal. It is capital at risk, not a sunk fee.
   Your finance person should see it as such.

### (c) Recurring: query costs

The published rate: **first 100K queries/month free, then $2 per 100,000 queries.**
The pricing page's own worked example: 300,000 monthly queries costs $4 (100K free +
200K billable).
> Source: [thegraph.com/studio-pricing](https://thegraph.com/studio-pricing/), verbatim:
> *"Your first 100K monthly queries are always free"* and *"$2 per 100,000 queries."*

At your stated volume:

| Monthly queries | Billable | Monthly cost |
|---|---|---|
| 1,000,000 | 900,000 | **$18** |
| 3,000,000 | 2,900,000 | **$58** |
| 5,000,000 | 4,900,000 | **$98** |
| 10,000,000 | 9,900,000 | **$198** |

**Budget line for "a few million queries": ~$58–98/month. Round to $100/month with
headroom.**

Payment: **credit/debit card via Stripe, or GRT** — monthly invoices either way. The billing
contracts are on Arbitrum One (*"All activity, including the billing contracts, is now on
Arbitrum One"*). If you pay by card, **you never have to touch GRT for queries** — which
matters if your finance process hates crypto. You still need ETH+GRT for the publish and
signal steps.
> Source: [Subgraph Studio introduction](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/).

### Numbers to re-check before committing

Flagging these explicitly since you asked:

- 🔴 **GRT and ETH spot prices** — snapshot from today. Re-pull before sign-off.
- 🔴 **The publish gas estimate (~$0.04)** — that's *my arithmetic*, not a documented number.
  The gas-units figure is an assumption. It's small enough that being 10× wrong doesn't
  change the budget, but don't quote it as sourced.
- 🔴 **The "3,000 GRT" recommendation** — documented today, but this is guidance that has
  moved before and depends on rewards eligibility. Re-read the publishing page at sprint
  start.
- 🟡 **$2 per 100K queries** — from the public pricing page today. Pricing pages change;
  re-check at sign-off. (Note: this rate has come *down* historically, so the risk is mild.)
- 🟡 **Whether the 100K free tier is per-account or per-subgraph** — the docs are
  inconsistent. The pricing page says *"Your first 100K monthly queries"* (sounds
  per-account); the docs elsewhere say *"Subgraphs on The Graph Network receive 100,000 free
  queries per month"* (sounds per-subgraph). At 3M queries this is a $2 difference — ignore
  it for the budget, but know it if you publish several subgraphs.
- 🟡 **Plan naming** — the pricing page shows one "Subgraph Studio" plan; the docs still say
  "Free Plan" / "Growth Plan." Cosmetic, but don't be surprised by the mismatch in the UI.
- 🟡 **Your actual query volume.** "A few million" is the number I'd least trust in this
  whole document. A marketplace frontend with polling, or a naive `useQuery` that refetches
  on every render, can 10× that without anyone noticing. See §5 — put caching in before you
  find out the hard way.

---

## 5. The API-key problem — decide this before you cut over

This is the part the draft's "our frontend can hit straight away" hides, and it's an
architecture decision, not a config line.

The docs say do **not** expose the API key in client-side apps. But a browser dApp has no
secret storage. Your two real options:

**Option A — Backend proxy (recommended for production).** Frontend calls your own API
route; your server holds the key in an env var and forwards to the gateway. Pros: key never
ships to the browser, you can cache and rate-limit per user, and you can swap providers
without a frontend release. Cons: you now run a service. For a Next.js/serverless frontend
this is a ~30-line route handler and is what I'd do.

**Option B — Domain-allowlisted key in the client.** Use Studio's **Add Domain** restriction
plus **Assign Subgraphs** plus a **spending limit**. The key is visible in the bundle, but
the gateway rejects it from other origins. Pros: no backend. Cons: origin headers are
trivially spoofed by a non-browser client, so the allowlist is a speed bump, not a wall —
the spending limit is what actually caps your downside. Acceptable for low-value read-only
data; the spending cap is mandatory if you go this route.

Either way: **set the monthly spending limit on day one.** It is the only thing standing
between you and an unbounded bill.

Also worth building in before launch, because they directly move the §4(c) line item:
- **Client-side query caching** (Apollo/urql normalized cache, or React Query with sane
  `staleTime`). Naive refetching is the #1 cause of query bills coming in 5× over estimate.
- **Avoid polling where a subscription-free refetch-on-action will do.**
- **A `_meta` freshness check** surfaced in your UI, so users see "data may be delayed"
  rather than silently wrong marketplace listings.

---

## 6. Resilience — what the runbook should say about failure

"A production endpoint we can rely on" deserves an explicit answer:

- **Indexer redundancy.** Your reliability is a function of how many indexers serve your
  subgraph. One indexer = one point of failure. Check indexer count in Graph Explorer after
  publishing and treat "only one indexer" as a launch blocker; more signal is the lever.
- **Keep the Studio deployment alive** as a break-glass endpoint. It's free and rate-limited,
  so it's not a production failover, but it's useful for debugging "is it the network or my
  subgraph?"
- **Consider a second provider for genuine failover.** [Goldsky](https://goldsky.com/pricing)
  runs the same subgraph format ($0.05/hr per worker + $4/100k entities, per their pricing
  page — 🔴 re-check, and note this is *entity*-based pricing, a different model from
  per-query, so it is not directly comparable to the $58/mo above without knowing your entity
  counts). Note that **Alchemy Subgraphs was sunset on 8 December 2025**, so if anyone
  suggests it as the fallback, it's another dead option —
  [Alchemy deprecation notice](https://www.alchemy.com/docs/alchemy-subgraphs/deprecation-notice).
- **Self-hosting your own Graph Node** is the third option: no per-query fees, but you own an
  indexing server, an archive RPC node or provider subscription, Postgres, and the on-call
  rotation. That's realistically hundreds of dollars a month plus engineer time — far more
  than $58/month. **Don't self-host to save money at this volume.** Self-host only if you
  need an unsupported chain or data-residency control.
- **Version-update drill.** Publishing a new version is an on-chain tx that must be signed by
  the owner wallet. Rehearse it once on a low-stakes change so you're not learning the
  multisig flow during an incident.

---

## 7. TL;DR for the runbook and the budget

**Replace the draft's ship step with:**
1. Create subgraph in Subgraph Studio, `graph auth <DEPLOY_KEY>`
2. `graph codegen && graph build && graph deploy <SLUG>` → verify in Studio (free, dev-only)
3. `graph publish` → on-chain tx on **Arbitrum One** (needs ETH on Arbitrum)
4. Signal ~3,000 GRT on your own subgraph to attract indexers
5. Wait for indexers to sync; verify with `_meta`; require ≥2 indexers before cutover
6. Create API key; set **domain allowlist + subgraph restriction + spending limit**
7. Route frontend queries through a **backend proxy**; add client caching

**Budget lines:**

| Line | Amount | Confidence |
|---|---|---|
| One-time setup (gas + approvals) | **< $5** | High that it's trivial; the exact figure is my estimate |
| ETH float on deploy wallet | **$50** | Recommendation |
| Curation signal (recoverable capital, at risk) | **3,000 GRT ≈ $39** today | Token amount documented; USD floats with GRT |
| Burned on curation tax (1%) | **~$0.40** | Documented rate |
| **Recurring queries @ 3M/month** | **~$58/month** | Documented rate; volume is your estimate |
| Recurring queries, budget with headroom | **$100/month** | Recommendation |

**The honest headline: your teammate was right that this is cheap, and wrong about
literally every mechanism. Standing it up costs pocket change; running it at a few million
queries costs about $58/month; the thing that actually needs engineering attention is the
API key architecture and indexer redundancy, neither of which the draft mentions.**

---

## Sources

- [The Road to Sunsetting the Hosted Service — The Graph](https://thegraph.com/blog/sunsetting-hosted-service/)
- [The Graph Network: The Sunrise of Decentralized Data — The Graph](https://thegraph.com/blog/transitioning-to-decentralized-graph-network/)
- [Quick Start — The Graph Docs](https://thegraph.com/docs/en/subgraphs/quick-start/)
- [Publishing a Subgraph to the Decentralized Network — The Graph Docs](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/)
- [Subgraph Studio introduction (billing, plans, Arbitrum) — The Graph Docs](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/)
- [Subgraph Studio pricing page](https://thegraph.com/studio-pricing/)
- [How to Manage API keys — The Graph Docs](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/)
- [Querying from an Application — The Graph Docs](https://thegraph.com/docs/en/subgraphs/querying/from-an-application/)
- [Curating — The Graph Docs](https://thegraph.com/docs/en/resources/roles/curating/)
- [Supported Networks — The Graph Docs](https://thegraph.com/docs/en/supported-networks/)
- [@graphprotocol/graph-cli — npm](https://www.npmjs.com/package/@graphprotocol/graph-cli) (v0.98.1, and `deploy --help` / `publish --help` run locally)
- [Alchemy Subgraphs Deprecation Notice](https://www.alchemy.com/docs/alchemy-subgraphs/deprecation-notice)
- [Goldsky Pricing](https://goldsky.com/pricing)
- [Sunsetting The Graph's Hosted Service — Alchemy](https://www.alchemy.com/blog/sunsetting-the-graphs-hosted-service)
- [The Graph's Hosted Service is Sunset — SubQuery](https://blog.subquery.network/graphs-hosted-service-is-sunset-deploy-your-subgraph-to-subquerys-managed-service-today/)
- Price/gas snapshots 2026-08-19: CoinGecko API (`the-graph`, `ethereum`), Coinbase spot API, Binance ticker API, Arbitrum One RPC `eth_gasPrice`
