# Shipping the marketplace subgraph to production

_Written 2026-08-19. Every figure below has a source and a "re-check before you commit it"
flag. Prices and GRT quotes move; the process doesn't._

---

## TL;DR for the runbook and the budget line

- **The draft ship step is not runnable.** The Graph's hosted service was shut down on
  **June 12, 2024**. There is no `--hosted-service` target, no free public endpoint, and no
  "no tokens" path. That whole sentence needs to be replaced.
- **The real path has two distinct steps that the draft collapses into one:** `graph deploy`
  (→ Subgraph Studio, a private, rate-limited *testing* endpoint) and **publish** (an onchain
  transaction on Arbitrum One that puts the subgraph on the network and gives you the
  production endpoint).
- **Queries are metered.** 100,000 free per month, then **$2 per 100,000**.
- **Budget:** stand-up is roughly **$40–$100 one-time-ish** (mostly recoverable curation
  signal + a few dollars of Arbitrum gas). At **3M queries/month: ~$58/month**. At
  **5M/month: ~$98/month**. Details and math below.
- **One thing the draft implies that is a security bug:** the frontend cannot "hit the
  endpoint straight away." The production endpoint requires an API key that The Graph's own
  docs say must not be shipped in client-side code. Budget a small proxy (or accept a
  restricted key — see "The API key problem").

---

## 1. What the draft step gets wrong

| Draft claim | Reality |
|---|---|
| `graph deploy --hosted-service marketplace` | The hosted service is gone (sunset **June 12, 2024**); no such deploy target exists. The current commands are `graph deploy <slug>` (to Studio) and `graph publish` (to the network). |
| "pushes it to production" | `graph deploy` only puts it in **Subgraph Studio** — a private testing/staging environment, rate-limited and not publicly visible. Deploying is **not** publishing. |
| "The hosted service is free" | Nothing about the production path is unconditionally free. 100K queries/month are free; beyond that it's metered at $2/100K. |
| "gives us a public GraphQL endpoint our frontend can hit straight away" | The production endpoint is gated by an **API key**, and the docs explicitly say: *"Always keep your API key in environment variables or a secure secrets manager. Do not hardcode it in your codebase or expose it in client-side apps."* |
| "no tokens, no billing, nothing to set up" | Wrong on all three. There are **four** distinct token/credential things (see §3), publishing is an **onchain transaction** requiring a funded wallet, and billing requires either a card or a GRT deposit. |

The reasoning behind the sunset matters for the runbook's tone: the hosted service was
Edge & Node running Graph Nodes as a free centralized service. It was always a subsidised
on-ramp, and the whole 2023–2024 "Sunrise" program existed to move everyone onto the
decentralized network before the plug was pulled. Any doc, tutorial, or LLM answer that
still says "deploy to the hosted service" is pre-mid-2024 and should be distrusted wholesale.

---

## 2. The actual go-live path

### Phase A — build and deploy to Studio (free, no chain interaction)

```bash
# in the subgraph repo
graph codegen && graph build

# authenticate the CLI with the deploy key from your subgraph's page in Studio
graph auth <DEPLOY_KEY>

# deploy to Studio -> private, rate-limited dev endpoint
graph deploy marketplace
```

What you get: a Studio dev query URL. Use it to confirm the subgraph **syncs against the
production chain** (not just your local Graph Node) and that your existing GraphQL queries
return the same shapes. This is the step where you find out that your local Graph Node was
forgiving about something the real chain isn't — reorgs, a contract that was redeployed, a
start block that's wrong, a data source template that never fired on mainnet.

**Runbook item: wait for full sync before proceeding.** A marketplace subgraph backfilling
from its deploy block can take hours to days depending on the chain, contract activity, and
handler cost. Put a real checkpoint here, not a "should be quick." Watch the indexing status
(`_meta { block { number } }` or the Studio sync indicator) until it reaches chain head.

### Phase B — publish to the network (onchain, costs money)

```bash
graph codegen && graph build
graph publish        # CLI ≥ v0.73.0; opens a browser wallet flow
```

or click **Publish** in the Studio dashboard. Either way:

- It is an **onchain transaction on Arbitrum One** (Arbitrum Sepolia for a testnet dry run).
  You need a browser wallet holding **ETH on Arbitrum One** for gas.
- Publish where the gas is cheap: the subgraph is published on Arbitrum One **regardless of
  which chain it indexes**. Your marketplace can be on Ethereum, Base, whatever — the publish
  and all future version bumps are Arbitrum transactions. The docs explicitly recommend
  publishing on Arbitrum One for the lower gas.
- You'll add metadata (name, description, image, categories) as part of this flow. It's
  public — treat it as a product surface, not a placeholder.
- The subgraph then appears in **Graph Explorer** with a **production query URL**.

### Phase C — curation signal (optional, recommended, mostly recoverable)

At publish time you're offered the chance to signal GRT on your own subgraph. Docs:
*"it is recommended that you curate your own Subgraph with at least 3,000 GRT in order to
attract additional Indexers."*

- **It is optional, not required.** The **Sunrise Upgrade Indexer** guarantees baseline
  indexing of all published subgraphs, so an unsignalled subgraph will still be served. That
  is a single-indexer dependency, though — signal is what buys you *redundancy* and
  competing indexers, i.e. the thing that makes the endpoint "one we can rely on."
- **The 3,000 GRT is not a fee — it's a deposit.** On Arbitrum you're guaranteed to get back
  the GRT you deposited, minus a **1% curation tax** on entry. Version migrations incur an
  additional **0.5%** tax each. So the true burn on 3,000 GRT is ~30 GRT plus ~15 GRT per
  version bump if you auto-migrate.
- **The real risk is price, not the fee.** You're holding GRT for the life of the subgraph.
  If GRT halves, so does the dollar value of that deposit. Book it as a *volatile asset
  position*, not an expense, and say so in the budget line.

### Phase D — API key and query wiring

1. Studio → **API Keys** → **Create API Key**. Set a **spending limit** on it while you're
   there.
2. Under the key's **Security** section: **Add Domain** (restrict to your frontend's
   origins) and **Assign Subgraphs** (restrict the key to this subgraph only). Do both.
   These are the only two things standing between a leaked key and someone else's bill.
3. Query URL, either form:
   - In the path: `https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>`
   - Or header: `Authorization: Bearer <API_KEY>` against the gateway endpoint
4. **Version pinning matters for the runbook.** Querying by *subgraph ID* follows the latest
   published version; querying by *deployment ID* pins an exact build. Pin the deployment ID
   if you want frontend rollouts and subgraph rollouts to be independently revertible;
   follow the subgraph ID if you want schema updates to take effect without a frontend
   deploy. Pick one deliberately and write it down — this is the knob that decides whether a
   bad subgraph publish is a frontend incident.

### Phase E — billing

Studio billing is usage-based, invoiced monthly, and you can pay by **credit card** or by
depositing **GRT on Arbitrum One** (GRT can be bridged in from Ethereum, ~15–20 min).
Unused balance can be withdrawn. Note only GRT is documented as the crypto option — if
someone on the team assumes USDC, correct them.

### Phase F — cutover and after

- Point the frontend at the gateway URL behind your proxy/env var.
- Keep the Studio dev endpoint as your staging target for future subgraph changes.
- Every subgraph change = build → deploy to Studio → verify → **publish (another Arbitrum
  tx)** → optionally migrate signal (0.5%). Publishing is not free-of-friction; it's a
  release process. Budget engineer time for it, not just gas.
- Monitor: query volume vs. spending limit, subgraph sync lag vs. chain head, and gateway
  error rate. A subgraph that silently stops indexing looks exactly like a quiet marketplace.

---

## 3. The four token-ish things (the draft says "no tokens")

| # | Thing | What it's for | Where it lives | Secret? |
|---|---|---|---|---|
| 1 | **Deploy key** | `graph auth` — lets the CLI push builds to Studio | CI secret | Yes |
| 2 | **Wallet + ETH on Arbitrum One** | Signing the publish transaction | A team wallet / multisig | Yes — and it's a signing key, treat it accordingly |
| 3 | **API key** | Every production query through the gateway | Server env var / secrets manager | Yes — docs say never client-side |
| 4 | **GRT** | Optional curation signal; optionally paying the bill | Arbitrum One | Asset, not a secret |

Also worth a runbook line: **who owns the publishing wallet?** The subgraph's ownership on
the network is tied to that address. If it's one engineer's MetaMask, you have a bus-factor
problem and an offboarding problem. A multisig is the boring correct answer.

---

## 4. The API key problem (the "hit it straight away" bit)

The gateway needs an API key on every request. The docs say not to expose it client-side.
Those two facts together mean the frontend **cannot** talk to the production endpoint the
way it talked to your local Graph Node. Three options, pick one before the sprint starts:

1. **Thin server-side proxy** (recommended). Your backend/edge function holds the key,
   forwards GraphQL requests, and can add caching + its own rate limiting. Cost: a small
   serverless function; a day of work; whatever your host charges (likely $0–$20/mo on an
   existing plan). This is also where you'd add a query allowlist if you care.
2. **Restricted key in the client.** Domain-restricted + subgraph-restricted + spending-limit
   capped. Contradicts the docs' guidance, but the blast radius is bounded by the spend
   limit. Acceptable for a low-stakes public read; it's a decision, not a default.
3. **Skip the gateway entirely** — self-host (see §6).

**Budget consequence:** if you don't already have a backend, option 1 adds a small infra
line and ~1 engineer-day. Don't let it appear as a surprise in week 2 of the sprint.

---

## 5. The money

### Stand-up (one-time)

| Item | Amount | Notes |
|---|---|---|
| Publish transaction (Arbitrum One gas) | **~$0.10–$5** | Arbitrum L1-data-fee dependent; ordinarily cents. **Re-check** — I did not measure this; it's an estimate from Arbitrum's normal fee range, not a quoted figure. |
| Curation self-signal (recommended) | **3,000 GRT ≈ $39** | At GRT = **$0.01309** (CoinGecko API, live, 2026-08-19). **Recoverable** minus 1% (~30 GRT ≈ $0.39). **Re-check the GRT price at commit time — this is the most volatile number here.** |
| Proxy build | ~1 engineer-day | See §4 |
| **Total cash outlay** | **~$40–$50**, of which ~$39 is a recoverable deposit | True burn is ~$1–$5 |

That's the headline: **standing this up is nearly free in dollars.** The cost is process and
engineer time, not infrastructure spend.

### Monthly queries

Rate: **first 100,000 free, then $2 per 100,000.**

| Monthly queries | Billable (over 100K) | Cost |
|---|---|---|
| 100,000 | 0 | **$0** |
| 1,000,000 | 900,000 | **$18** |
| 3,000,000 | 2,900,000 | **$58** |
| 5,000,000 | 4,900,000 | **$98** |
| 10,000,000 | 9,900,000 | **$198** |

**So "a few million queries a month" is roughly $20–$100/month.** For a production dApp
backend that is small enough that the budget conversation should be about the *variance*,
not the mean.

### Sizing the query count — do this before you commit a number

The $ figure is trivially derived; **the query count is the number that will actually be
wrong.** A naive React frontend generates far more queries than you'd guess:

- Every page load of a marketplace listing page = 1+ query. Filters, sort changes, pagination
  clicks, and tab switches each fire another.
- React Query / Apollo default refetch-on-focus and polling can multiply this by 3–10× with
  no user action at all.
- 3M/month ≈ **100K/day** ≈ **~1.2 queries/second sustained**. Sanity-check that against your
  actual expected DAU × sessions × queries-per-session. If the arithmetic doesn't roughly
  land on your marketing traffic forecast, one of the two is wrong.

**Two mitigations that move the budget more than the rate does:**
- Cache aggressively at the proxy. A 60-second cache on listing queries can cut billed volume
  by an order of magnitude on a read-heavy marketplace.
- Turn off reflexive refetching in the client. This is usually where the surprise 5× lives.

**Set a spending limit on the API key** so a frontend polling bug is a $50 incident, not a
$5,000 one. This is the single highest-value line in the runbook.

---

## 6. Alternatives, so the budget line is a choice and not an assumption

You do **not** have to use The Graph Network. Your subgraph code is portable to anything that
runs Graph Node.

- **Self-host Graph Node.** Free of per-query fees; you pay for a VM, a Postgres with real
  storage, and an archive-node RPC. Realistically **$100–$400+/month** all-in for something
  you'd trust in production, plus ongoing ops: process supervision, backups, resync when it
  falls over, alerting. Cheaper than metered queries only at high volume, and never cheaper
  in engineer-hours. **Re-check with real quotes from your host + RPC provider.**
- **Managed subgraph hosts** — Goldsky, Alchemy Subgraphs, Ormi, SubQuery, Chainstack. These
  run your existing subgraph and hand you an endpoint, with pricing models based on
  worker-hours, entities, or flat monthly tiers. Reported figures floating around include
  Goldsky ~$0.05/worker-hour for subgraphs and $4/100K entities, Ormi $4/100K entities,
  Chainstack ~$99/month, SubQuery ~$0.20/hr. **Treat every one of those as unverified** — I
  got them from a third-party comparison blog, not vendor pricing pages. If you seriously
  consider one, price it from the vendor's own page.

**My recommendation:** publish to The Graph Network. At your volume the cost is noise, you
already have a working subgraph, the decentralized network removes the single-vendor risk
that just bit everyone when the hosted service died, and the operational surface is an API
key instead of a Postgres you have to babysit. Revisit if query volume goes past ~20M/month,
where self-hosting starts to pencil out.

---

## 7. Numbers to re-check before committing to the budget

Ranked by how likely they are to move:

1. **GRT/USD price** — $0.01309 as of 2026-08-19 (CoinGecko). Most volatile input. The 3,000
   GRT recommendation is denominated in GRT, so the dollar figure moves with the market.
2. **Your actual query volume** — the biggest unknown, and the only one that scales your bill.
   Instrument before you commit (§5).
3. **$2 per 100K and the 100K free tier** — from The Graph's own pricing page today. One
   search result quoted "$1.5–$2 per 100K"; the official page says **$2 per 100K**, so I used
   $2. Re-read the live pricing page the week you commit.
4. **The 3,000 GRT recommendation** — that guidance dates from May 2024 and is repeated in
   current docs. Confirm it's still the stated recommendation at publish time.
5. **Arbitrum gas for the publish tx** — my $0.10–$5 range is an estimate, not a measurement.
   Check a gas tracker on the day, or just fund the wallet with $20 of ETH and stop thinking
   about it.
6. **Alternative-provider pricing** — all second-hand. Verify at the vendor if you shortlist.
7. **Gateway rate limits** — docs confirm keys enforce rate limits but don't publish the
   thresholds. Ask support if you expect bursty traffic.

---

## 8. Replacement text for the teammate's runbook

> **Ship step.**
> 1. `graph codegen && graph build`
> 2. `graph auth <DEPLOY_KEY>` (deploy key from the subgraph's page in Subgraph Studio)
> 3. `graph deploy marketplace` — deploys to **Studio only**: a private, rate-limited testing
>    endpoint. **Not production.**
> 4. Verify sync against the production chain via the Studio dev endpoint. **Wait for full
>    sync to chain head.** Re-run our GraphQL test queries against it.
> 5. `graph publish` (or Publish in Studio) — **onchain transaction on Arbitrum One**;
>    requires the team publishing wallet funded with ETH on Arbitrum. Add public metadata.
> 6. Optionally signal ≥3,000 GRT on our own subgraph to attract additional indexers
>    (recoverable minus 1%; the Sunrise Upgrade Indexer covers baseline indexing without it).
> 7. Create an API key in Studio. Set a **spending limit**, restrict it to **our domains**,
>    and assign it to **this subgraph only**.
> 8. Wire the frontend through our server-side proxy holding the key —
>    `https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>`.
>    **Never ship the key to the browser.**
> 9. Set up billing: credit card, or deposit GRT on Arbitrum One.
> 10. Add monitoring: query volume vs. spend limit, sync lag vs. chain head, gateway errors.
>
> **Budget:** ~$40 to stand up (~$39 of it a recoverable GRT deposit); ~$58/month at 3M
> queries (100K free, then $2/100K). Re-check GRT price and our real query volume before
> finalising.

---

## Sources

- [Subgraph Studio Pricing | The Graph](https://thegraph.com/studio-pricing/) — 100K free
  queries/month, $2 per 100K after, pay by card or crypto, no monthly minimum. (Fetched
  2026-08-19.)
- [Subgraph Studio introduction / billing | The Graph Docs](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/)
  — usage-based monthly invoicing, free plan = 100K queries, credit card or GRT on Arbitrum
  One (bridging from Ethereum takes 15–20 min), withdraw unused balance.
- [The Road to Sunsetting the Hosted Service | The Graph Blog](https://thegraph.com/blog/sunsetting-hosted-service/)
  — hosted service decommissioned **June 12, 2024**; all queries now served by The Graph
  Network.
- [Publishing a Subgraph to the Decentralized Network | The Graph Docs](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/)
  — publish is onchain on Arbitrum One (Arbitrum Sepolia for testnet); `graph publish` on CLI
  ≥ v0.73.0; signal optional but *"recommended that you curate your own Subgraph with at
  least 3,000 GRT"*; *"The Sunrise Upgrade Indexer ensures the indexing of all Subgraphs"*;
  subgraphs can index any supported network regardless of publish chain.
- [Quick Start | The Graph Docs](https://thegraph.com/docs/en/subgraphs/quick-start/) —
  `graph init`, `graph codegen && graph build`, `graph auth <DEPLOY_KEY>`,
  `graph deploy <SUBGRAPH_SLUG>`, `graph publish`; Studio endpoint is rate-limited and not
  publicly visible; network endpoint gets 100K free queries/month.
- [How to Manage API Keys | The Graph Docs](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/)
  — key creation, optional spending limit, domain restrictions, subgraph assignment, URL
  format `https://gateway.thegraph.com/api/<YOUR_API_KEY>/subgraphs/id/<SUBGRAPH_ID>`,
  `Authorization: Bearer` alternative, and *"Do not hardcode it in your codebase or expose it
  in client-side apps."*
- [Curating | The Graph Docs](https://thegraph.com/docs/en/resources/roles/curating/) — 1%
  curation tax on signalling, 0.5% per auto-migration, no cooldown on withdrawal, and on
  Arbitrum *"you are guaranteed to get back the GRT you initially deposited (minus the tax)."*
- [Arbitrum FAQ / L2 scaling | The Graph](https://thegraph.com/blog/the-graph-L2-scaling-with-arbitrum/)
  — publishing/updating interacts with contracts requiring ETH gas; Arbitrum One recommended
  for lower fees.
- [CoinGecko API — the-graph simple price](https://api.coingecko.com/api/v3/simple/price?ids=the-graph&vs_currencies=usd)
  — GRT = **$0.01308737** at fetch time, 2026-08-19. Volatile; re-check.
- [Top 5 hosted Subgraph indexing platforms in 2026 | Chainstack Blog](https://chainstack.com/top-5-hosted-subgraph-indexing-platforms-2026/)
  and [Goldsky Pricing](https://goldsky.com/pricing) — third-party comparison figures for
  Goldsky/Ormi/Chainstack/SubQuery. **Unverified against vendor pricing pages — do not budget
  from these without checking.**
