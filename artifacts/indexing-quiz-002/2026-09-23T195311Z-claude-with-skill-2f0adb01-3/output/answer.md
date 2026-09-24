# Shipping the marketplace subgraph to production

_Written 2026-09-23. Every figure below has a source and a "re-check before budgeting" flag where it moves._

---

## TL;DR

The draft runbook's ship step cannot work. `graph deploy --hosted-service` targets a product that was
switched off on **12 June 2024**. There is no free public endpoint to fall back on, and "no tokens" is
wrong in three separate places: publishing is an onchain transaction on Arbitrum One, curation signal is
denominated in GRT, and the production query endpoint is gated by an API key that must never ship in
frontend JavaScript.

The real path is: **Studio deploy → publish onchain to the decentralized network → set up billing →
create a restricted API key → proxy queries from your own backend.**

Budget: roughly **$80–$150 one-time** to stand up, and **~$58/month at 3M queries** (~$98 at 5M) in
query fees. Both numbers have caveats below.

---

## 1. What the draft step gets wrong

| Claim in the draft | Reality |
|---|---|
| `graph deploy --hosted-service marketplace` | The hosted service was decommissioned **12 June 2024**. The command's target no longer exists; modern `graph-cli` doesn't even carry the flag. ([The Graph blog: Sunsetting the Hosted Service](https://thegraph.com/blog/sunsetting-hosted-service/)) |
| "The hosted service is free" | Gone entirely. Its successor, Subgraph Studio, is free only up to **100,000 queries/month**; past that you pay. ([Studio pricing](https://thegraph.com/studio-pricing/)) |
| "gives us a public GraphQL endpoint our frontend can hit straight away" | The production endpoint is the gateway, and it requires an **API key**. The docs are explicit: "Do not hardcode it in your codebase or expose it in client-side apps." A browser-side fetch with the key baked in is a billing-exposure bug, not a deployment. ([Managing API keys](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/)) |
| "no tokens" | Publishing is a transaction on **Arbitrum One** — you need a wallet and ETH for gas. Curation signal is in **GRT**. Query billing can be settled in GRT *or* by card, so the card route does let you avoid holding GRT for billing — but not for publishing gas or signal. ([Publishing a subgraph](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/), [Billing](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/)) |
| "no billing, nothing to set up" | You must attach a payment method *before* you exceed the free tier, or queries stop. Plus: re-sync time on the network, version/deployment-ID pinning, and monitoring. |

One more trap worth calling out in the runbook explicitly: the **Studio dev endpoint**
(`api.studio.thegraph.com/query/...`) *does* work right after `graph deploy`, is rate-limited, and is
labelled a testing environment. It is very tempting to point the frontend at it and call the sprint done.
Don't — it is not a production SLA and it is not what the free/paid quota is designed around.

---

## 2. The actual go-live path

**Step 0 — confirm your chain is supported on the decentralized network.**
Supported-network coverage for *published* subgraphs is narrower than for Studio-only deploys. If your
marketplace is on a long-tail chain, check this first; it can invalidate the whole plan.
→ *Re-check: the supported-networks list changes often.*

**Step 1 — deploy to Subgraph Studio.**
```bash
npm i -g @graphprotocol/graph-cli   # need >= 0.73.0 for `graph publish`
graph codegen && graph build
graph auth <DEPLOY_KEY>
graph deploy marketplace
```
Let it sync fully in Studio and re-run your GraphQL tests against the Studio endpoint. This is the same
verification you already did locally, but against The Graph's own graph-node build — catches
version-skew bugs.

**Step 2 — publish to the decentralized network (this is the onchain bit).**
From the Studio dashboard's Publish button, or `graph publish`. This writes to **Arbitrum One**
(Arbitrum Sepolia for a dry run) and pins the manifest to IPFS. You need a wallet with **ETH on
Arbitrum** for gas.

**Step 3 — signal curation on your own subgraph (optional, recommended).**
The docs recommend self-curating with **at least 3,000 GRT** to attract indexers beyond the baseline
"Sunrise" upgrade indexer. Since Sunrise, every published subgraph gets indexed by the upgrade indexer
even with zero signal — so you *can* publish with no GRT at all. Signal buys you redundancy and
latency, which is exactly what "an endpoint we can rely on" means. I'd budget it.
→ Signal is withdrawable at any time on Arbitrum with no cooldown, **minus a 1% curation tax that is
burned**. A 0.5% tax applies again on each auto-migrate to a new version.
([Curating](https://thegraph.com/docs/en/resources/roles/curating/))

**Step 4 — set up billing.** Arbitrum One is where all billing contracts live. Either deposit GRT to the
billing contract (you still need Arbitrum ETH for that deposit's gas) or attach a card via Stripe,
invoiced monthly.

**Step 5 — create a production API key, locked down.**
Set all three controls the console offers: a **domain restriction**, a **subgraph restriction** (this key
can only query *this* subgraph), and a **monthly spending limit in USD**. The spending limit is your
blast radius if the key leaks or a polling loop goes haywire.

**Step 6 — put the key behind your own backend.**
The frontend calls *your* API route; your route calls
`https://gateway.thegraph.com/api/subgraphs/id/<SUBGRAPH_ID>` with `Authorization: Bearer <KEY>`.
(The older `…/api/<KEY>/subgraphs/id/<ID>` path form also works but puts the key in the URL — prefer the
header.) This also gives you the place to add caching, which is the single biggest lever on your monthly
bill.

**Step 7 — operational hygiene before you call it shipped.**
- Pin the **deployment ID**, not the "latest version" pointer, if you want reproducible query results;
  use the subgraph ID if you want auto-follow of new versions. Decide which, deliberately.
- Have a documented redeploy-and-republish path for when mappings change.
- Alert on gateway error rate and on indexing lag (`_meta { block { number } }` vs chain head).
- Keep the local Graph Node in CI as your regression suite.

---

## 3. What it costs

### One-time / stand-up

| Item | Cost | Source | Confidence |
|---|---|---|---|
| Subgraph Studio account + deploy | **$0** | [Studio pricing](https://thegraph.com/studio-pricing/) | Solid |
| Publish tx gas (Arbitrum One) | **~$0.10–$2** | Arbitrum L2 gas, not a published Graph figure | Rough — it's L2 gas, it's noise in your budget, but it's non-zero and needs a funded wallet |
| Self-curation signal | **3,000 GRT ≈ $72–$82** at GRT $0.024–0.027 | 3,000 GRT from [publishing docs](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/); price from [CoinGecko](https://www.coingecko.com/en/coins/the-graph) / [CoinMarketCap](https://coinmarketcap.com/currencies/the-graph/), 22–23 Sep 2026 | **Re-check the GRT price on the day.** Quotes ranged $0.018–$0.027 across sources in the same 24h |
| …of which permanently burned (1% tax) | **30 GRT ≈ $0.75** | [Curating docs](https://thegraph.com/docs/en/resources/roles/curating/) | Solid |
| ETH on Arbitrum for gas, buffer | **~$20** | Judgement call | Just a float, not a cost |

**Stand-up total: ~$95–$105**, of which ~$72–82 is *recoverable* (signal, minus the ~1% burn) if you
later withdraw. If you publish with zero signal, stand-up is effectively **under $25**.

### Monthly, on query volume

Rate: **$2 per 100,000 queries** above a **100,000 query/month free allowance**
([Studio pricing](https://thegraph.com/studio-pricing/)).

| Monthly queries | Billable (above 100k) | Cost |
|---|---|---|
| 100,000 | 0 | **$0** |
| 1,000,000 | 900,000 | **$18** |
| 3,000,000 | 2,900,000 | **$58** |
| 5,000,000 | 4,900,000 | **$98** |
| 10,000,000 | 9,900,000 | **$198** |

**At "a few million queries" — budget $58–$98/month.** That is genuinely cheap; the risk in your budget
line isn't the rate, it's the *denominator*.

⚠️ **The number most likely to burn you is query count, not price.** A React component with a 5-second
poll, mounted on a page one user leaves open for an hour, is 720 queries — from one tab. Multiply by
your DAU and you can cross a few million without any of it being "real" traffic. Before you commit a
number, instrument the Studio dashboard for a week against realistic frontend behaviour, and put
caching in the backend proxy from day one. My table above is arithmetic on your stated volume; it is
not a traffic forecast.

⚠️ **This rate was $4/100k historically and is $2/100k as of today.** It has moved. Re-check
[thegraph.com/studio-pricing](https://thegraph.com/studio-pricing/) on the day you commit the line.

### What is *not* in the above
- **Engineering time** to build the proxy/caching layer — likely your largest real cost.
- **Enterprise tier** exists but is unpriced publicly; irrelevant at a few million queries.
- **Re-sync time** after publishing. If your marketplace contract is old and your mappings are heavy,
  the network indexer may take hours-to-days to catch up. This is a *schedule* cost, not a dollar cost,
  and it belongs in the sprint plan. Don't schedule the frontend cutover for the same day as the publish.

---

## 4. If you'd rather not go onchain at all

Legitimate alternative: a managed subgraph host. Your existing subgraph code runs unmodified.

- **Goldsky** — roughly **$0.05/hr per subgraph worker (~$36.50/mo)** plus **$4/100k entities**, free
  tier available ([Goldsky pricing](https://goldsky.com/pricing)). *Re-check — pricing pages move, and
  the entity-based metric is not comparable to The Graph's query-based one without measuring your own
  workload.*
- **Alchemy Subgraphs is not an option** — sunset **8 December 2025**, with Alchemy itself pointing users
  at Goldsky ([Alchemy deprecation notice](https://www.alchemy.com/docs/alchemy-subgraphs/deprecation-notice)).
  Worth a line in the runbook so nobody reaches for it.
- **Self-hosting Graph Node** — you already run one locally. In production this is an archive-node RPC
  bill plus a Postgres plus an on-call rotation. Almost certainly more expensive than $58/month once
  you price the engineer.

**Recommendation:** publish to the decentralized network. At your volume it's the cheapest option, it's
the one the tooling is built around, and the "decentralized" part is a genuine availability argument for
a production dApp rather than a philosophical one. Note the tradeoff honestly in the runbook: it costs
you an onchain publish step and a wallet in the deploy path, which managed hosting doesn't.

---

## 5. Numbers to re-verify before you commit the budget

1. **$2 / 100k queries** — has already changed once (from $4). ← highest-impact
2. **GRT spot price** — swung $0.018–$0.027 across sources on the same day.
3. **3,000 GRT recommended signal** — a docs recommendation, not a protocol minimum; verify it still
   reads that way, and decide whether you need it at all given the Sunrise upgrade indexer.
4. **Your chain's support status** on the decentralized network.
5. **Your actual query volume** — the one I have the least basis for. Everything above is arithmetic on
   your "few million"; measure it.
6. **Goldsky's pricing**, only if you go that route.

## Sources

- [The Road to Sunsetting the Hosted Service — The Graph](https://thegraph.com/blog/sunsetting-hosted-service/)
- [Subgraph Studio Pricing](https://thegraph.com/studio-pricing/)
- [Subgraph Studio / Billing docs](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/)
- [Publishing a Subgraph](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/)
- [Managing API Keys](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/)
- [Curating](https://thegraph.com/docs/en/resources/roles/curating/)
- [GRT price — CoinGecko](https://www.coingecko.com/en/coins/the-graph) / [CoinMarketCap](https://coinmarketcap.com/currencies/the-graph/)
- [Goldsky Pricing](https://goldsky.com/pricing)
- [Alchemy Subgraphs Deprecation Notice](https://www.alchemy.com/docs/alchemy-subgraphs/deprecation-notice)
