# Shipping the subgraph: the real go-live path (and what it costs)

**Written 2026-08-19.** Every figure below has a source and a "re-check before you
commit it" flag. Crypto-denominated numbers (GRT, gas) move daily; the USD query
price is a posted list price and has changed at least once historically.

---

## 1. What the draft runbook gets wrong

The draft step is:

> `graph deploy --hosted-service marketplace` … "The hosted service is free and gives
> us a public GraphQL endpoint our frontend can hit straight away — no tokens, no
> billing, nothing to set up."

Five separate problems:

**(a) The hosted service no longer exists.** The Graph retired it on **June 12, 2024**
as the final ("Sunrise") phase of the *Sunrise of Decentralized Data* migration.
The endpoints are dead and the `--hosted-service` flag is gone from the CLI. This
command will not fail with a billing error — it will fail as an unrecognised
flag/unknown target. Anything in the runbook downstream of it is untested.
*Source: [The Graph — Sunsetting the Hosted Service](https://thegraph.com/blog/sunsetting-hosted-service/), [The Sunrise of Decentralized Data](https://thegraph.com/blog/transitioning-to-decentralized-graph-network/).*

**(b) "Deploy" and "publish" are two different steps now.** `graph deploy` puts your
subgraph in **Subgraph Studio**, which is explicitly *not* production. The docs say a
Studio deployment is "free to use, rate-limited, not visible to the public, and meant
to be used for development, staging, and testing purposes."
Production requires a second step, `graph publish`, which is an **on-chain transaction**.
*Source: [The Graph docs — Quick Start](https://thegraph.com/docs/en/subgraphs/quick-start/).*

**(c) It is not free at your volume.** The Free plan is **100,000 queries/month**;
past that it is **$2 per 100,000 queries**. A "few million queries" is squarely in
paid territory. *Source: [Subgraph Studio Pricing](https://thegraph.com/studio-pricing/), [docs — Subgraph Studio](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/).*

**(d) "No tokens" is wrong twice.** Publishing is a transaction on **Arbitrum One**, so
you need a funded wallet with **ETH on Arbitrum** for gas. And the recommended step of
signalling on your own subgraph is denominated in **GRT**. (Billing itself *can* be
card-only — see §4 — so tokens are avoidable for the recurring spend, but not for the
publish transaction.)
*Source: [docs — Publishing a Subgraph](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/), [docs — Subgraph Studio](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/) ("All activity, including the billing contracts, is now on Arbitrum One").*

**(e) There is no anonymous public endpoint.** Production queries go through the
gateway and **every query URL requires a valid API key**. Your frontend cannot "hit it
straight away" — and the docs explicitly tell you *not* to ship the key in a client
bundle: "Always keep your API key in environment variables or a secure secrets manager.
Do not hardcode it in your codebase or expose it in client-side apps."
That's an architectural item for the sprint, not a footnote.
*Source: [docs — Managing API Keys](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/).*

---

## 2. The actual runbook: local → production

### Phase 1 — Studio (free, no chain interaction)

1. **Create the subgraph in Subgraph Studio** (connect a wallet to sign in). You get a
   subgraph slug and a **deploy key**.
2. **Authenticate the CLI:** `graph auth <DEPLOY_KEY>`
3. **Build and deploy:**
   ```
   graph codegen && graph build
   graph deploy <SUBGRAPH_SLUG>
   ```
   (Note the modern form — no `--hosted-service`, and `--studio` is no longer needed.)
   *Source: [Quick Start](https://thegraph.com/docs/en/subgraphs/quick-start/).*
4. **Verify against the Studio endpoint.** This is your staging gate: confirm it syncs
   to chain head against the real network (not your local Graph Node), and re-run the
   query suite you already have. Expect rate limits here — do not load-test against it.

**Gate for the runbook:** do not proceed to publish until sync reaches chain head with
zero non-deterministic errors. Publishing a broken version costs a second on-chain
transaction to fix.

### Phase 2 — Publish to the network (on-chain, costs money)

5. **Publish:** `graph publish` (CLI ≥ 0.73.0) or the **Publish** button in Studio.
   A wallet window opens; you sign a transaction on **Arbitrum One**. This is what
   makes the subgraph visible in Graph Explorer and indexable by Indexers.
   *Source: [Publishing a Subgraph](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/).*
6. **Signal (curate) on your own subgraph — recommended, not mandatory.** The docs say
   "it is recommended that you curate your own Subgraph with at least **3,000 GRT** in
   order to attract additional indexers," and the Quick Start repeats "Curation with
   3,000+ GRT is recommended to incentivize indexing."
   You are *not* stranded without it: the **Sunrise Upgrade Indexer** indexes all
   published subgraphs as a baseline, so queries work — but with one indexer serving you
   and no redundancy. For a production dApp you want more than one indexer, which is
   what the signal buys.
   *Sources: [Publishing a Subgraph](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/), [Quick Start](https://thegraph.com/docs/en/subgraphs/quick-start/), [Curating](https://thegraph.com/docs/en/resources/roles/curating/).*

### Phase 3 — Keys, billing, and the frontend

7. **Create an API key** in Studio and lock it down. Three controls are available and
   all three should be in the runbook:
   - **Domain allowlist** (Security → Add Domain)
   - **Subgraph assignment** — restrict the key to *this* subgraph only
   - **Monthly spending limit in USD, per billing period (calendar month)** — this is
     your blast-radius control against a runaway loop or a leaked key
   *Source: [Managing API Keys](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/).*
8. **Set up billing** — add a card, or deposit GRT to the billing balance (see §4).
9. **Wire the frontend.** Two documented call shapes:
   ```
   https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
   ```
   or, preferred, key in a header:
   ```
   POST https://gateway.thegraph.com/api/subgraphs/id/<SUBGRAPH_ID>
   Authorization: Bearer <API_KEY>
   ```
   **Recommendation:** route queries through a thin server-side proxy (an API route on
   whatever already serves your frontend) holding the key in an env var. A domain
   allowlist on a browser-embedded key is a speed bump, not a control — Origin headers
   are trivially forged by anything that isn't a browser, and your spend limit is the
   real backstop. Budget a day of frontend work for this; it is the item most likely to
   be missing from the teammate's plan.
   *Source: [Managing API Keys](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/).*

### Phase 4 — Operational items to put in the runbook

10. **Version pinning.** Querying by *subgraph ID* always serves the latest published
    version; querying by *deployment ID* pins an exact build. Decide which you want —
    pinning gives you deterministic frontend behaviour and a manual promote step;
    latest gives you zero-touch upgrades and the risk of a schema change landing under
    a live frontend. For a marketplace, pin, and promote deliberately.
11. **Updates are re-publishes.** Every new version is another Arbitrum transaction and
    another gas cost. Curators migrating signal to a new version pay a **0.5% tax on
    auto-migration, 1% if migrating manually** — relevant if you hold your own signal.
    *Source: [Curating](https://thegraph.com/docs/en/resources/roles/curating/).*
12. **Fallback plan.** The decentralized network has no contractual SLA to you. Decide
    now whether a degraded mode (cached data / direct RPC reads / a secondary provider)
    is in scope this sprint or explicitly deferred.

---

## 3. Cost to stand up (one-time)

| Item | Cost | Source | Re-check? |
|---|---|---|---|
| Studio account, deploys, testing | **$0** | [Quick Start](https://thegraph.com/docs/en/subgraphs/quick-start/) | No |
| `graph publish` tx on Arbitrum One | **ETH gas** — Arbitrum's gas price floor is 0.1 gwei; a contract call is typically well under $1 | [Arbiscan gas tracker](https://arbiscan.io/gastracker), [Arbitrum gas docs](https://docs.arbitrum.io/how-arbitrum-works/deep-dives/gas-and-fees) | **YES — I did not measure this transaction.** Budget $5–10 to cover the publish plus a couple of re-publishes and be safe. |
| Self-curation signal (recommended) | **3,000 GRT ≈ $39** at GRT $0.01309 | [Publishing docs](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/) for the 3,000; [CoinGecko](https://www.coingecko.com/en/coins/the-graph) for the price (quoted 2026-08-19) | **YES — GRT price. This is the most volatile number on the page.** |
| Curation tax (burned, unrecoverable) | **1%** of signal ≈ 30 GRT ≈ **$0.39** | [Curating](https://thegraph.com/docs/en/resources/roles/curating/) | Rate is stable; USD value follows GRT |

**Realistic one-time line: ~$50, dominated by the GRT signal.**

Two accounting notes for the budget:

- **Signal is capital, not expense.** Curators "can withdraw signaled GRT anytime
  without cooldown periods, receiving the entire amount (minus the 1% curation tax)."
  So ~99% of the 3,000 GRT is recoverable *in GRT terms*. But: (i) you're exposed to GRT
  price movement while it sits there, and (ii) on the bonding curve, if other curators
  exit first the remaining shares are worth less GRT. Book it as an at-risk deposit,
  not a prepaid asset. *Source: [Curating](https://thegraph.com/docs/en/resources/roles/curating/).*
- **You can skip the signal at launch.** The Upgrade Indexer will index you regardless.
  If ~$40 of GRT exposure is more procurement friction than it's worth, ship without it
  and add signal if you see indexer availability or latency problems. Worth knowing
  before someone spends two weeks getting a token purchase approved.

---

## 4. Cost per month to run

**Posted price: 100,000 free queries/month, then $2 per 100,000.**
The pricing page's own worked example: 300,000 queries/month = $4 (first 100K free,
200K billable). *Source: [Subgraph Studio Pricing](https://thegraph.com/studio-pricing/).*

At your "few million" figure:

| Monthly queries | Billable (after 100K free) | Cost |
|---|---|---|
| 1,000,000 | 900,000 | **$18** |
| 2,000,000 | 1,900,000 | **$38** |
| 3,000,000 | 2,900,000 | **$58** |
| 5,000,000 | 4,900,000 | **$98** |
| 10,000,000 | 9,900,000 | **$198** |

*(My arithmetic from the posted $2/100K rate — not quoted from The Graph.)*

**Budget line: $50–100/month at 2–5M queries. Call it $100/month with headroom.**

**Payment methods** — card or GRT, your choice:
- **Credit/debit card**: entered in Studio, invoiced monthly. *This is the option that
  keeps tokens entirely out of your recurring spend* — worth telling your finance team,
  since "we need to buy crypto monthly" is usually the blocker.
- **GRT**: deposit to your billing balance on Arbitrum; invoices auto-pay while funded.
  Requires GRT *and* ETH on Arbitrum One.
*Source: [docs — Subgraph Studio](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/).*

**Caution on the query-count estimate itself.** The dollar rate is the easy part; the
denominator is where budgets go wrong. Every component that fires its own query counts
separately, and an unmemoized React hook or a polling interval can multiply your volume
by 10x without anyone noticing. Before committing a number, instrument the frontend
against the Studio endpoint for a day and count actual queries per session, then
multiply by projected sessions. Set the API key's monthly spend limit to ~2x your
budget as a hard stop.

---

## 5. Numbers to re-check before you commit the budget

Ranked by how much damage a stale value does:

1. **GRT/USD price** — I used **$0.01309 (CoinGecko, 2026-08-19)**. This has ranged over
   an order of magnitude historically. Re-price the 3,000 GRT on the day you buy.
2. **Your actual query volume** — see above. The biggest single source of error.
3. **Arbitrum gas for `graph publish`** — I did not measure the transaction; I only
   confirmed the network's gas floor. Check [gas.arbitrum.io](https://gas.arbitrum.io/)
   or just watch the wallet estimate at signing time.
4. **$2 per 100,000 queries** — from the live pricing page today, but note this rate was
   **$4/100K** historically, so it demonstrably changes. Re-read
   [thegraph.com/studio-pricing](https://thegraph.com/studio-pricing/) at commit time.
5. **100,000 free queries/month** — consistent across the pricing page and docs today,
   but it's a promotional-style allowance; verify it still applies to *published*
   subgraphs on your plan.
6. **3,000 GRT signal recommendation** — a docs recommendation, not a protocol minimum,
   and it has been revised before.
7. **Card payment availability / any minimum charge or deposit** — the docs confirm
   cards are supported but I found no stated minimum; confirm in Studio's billing UI
   before assuming there's no floor.

---

## 6. The alternative worth pricing alongside it

If the sprint's real constraint is "no wallet, no tokens, no on-chain transaction," a
managed Graph-compatible host removes all of that — same subgraph code, a normal SaaS
invoice, no publish transaction and no curation. **Goldsky** and **Alchemy Subgraphs**
are the common targets, both with free tiers and no credit card required to start;
Goldsky's posted model is worker-hours plus data volume rather than per-query.
*Sources: [Goldsky pricing](https://goldsky.com/pricing), [Chainstack — hosted subgraph platforms 2026](https://chainstack.com/top-5-hosted-subgraph-indexing-platforms-2026/). **Re-check all third-party pricing directly** — I have not verified these against the vendors' current pages in detail.*

**My recommendation:** go with The Graph Network. At ~$50 one-time and ~$60/month at 3M
queries it is cheap, the decentralized path is what your subgraph was written for, and
multi-indexer redundancy is a real availability property that a single vendor doesn't
give you. The managed hosts are the right call only if procurement genuinely cannot
accommodate a wallet with $50 of ETH and GRT in it — which is a reasonable thing to be
true, and worth finding out this week rather than mid-sprint.

---

## 7. Corrected ship step for the runbook

```
# Phase 1 — Studio (free)
graph auth <DEPLOY_KEY>
graph codegen && graph build
graph deploy marketplace
# → verify sync to chain head + run query suite against the Studio endpoint

# Phase 2 — Network (Arbitrum One tx, needs ETH for gas)
graph publish
# → optionally signal 3,000+ GRT on your own subgraph in Studio/Explorer

# Phase 3 — Access
# Studio → create API key → set domain allowlist + assign subgraph + monthly spend limit
# Billing → add card OR deposit GRT on Arbitrum One
# Frontend → server-side proxy holding the key in an env var, calling:
#   POST https://gateway.thegraph.com/api/subgraphs/id/<SUBGRAPH_ID>
#   Authorization: Bearer <API_KEY>
```

**Prerequisites the draft runbook is missing entirely:** a funded wallet on Arbitrum
One (ETH for gas, optionally GRT for signal), a billing method on file, an API-key
security configuration, and frontend proxy work.

---

## Sources

- [The Graph — The Road to Sunsetting the Hosted Service](https://thegraph.com/blog/sunsetting-hosted-service/)
- [The Graph — The Sunrise of Decentralized Data](https://thegraph.com/blog/transitioning-to-decentralized-graph-network/)
- [The Graph docs — Quick Start](https://thegraph.com/docs/en/subgraphs/quick-start/)
- [The Graph docs — Publishing a Subgraph](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/)
- [The Graph docs — Subgraph Studio (billing & payment methods)](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/)
- [The Graph docs — Managing API Keys](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/)
- [The Graph docs — Curating](https://thegraph.com/docs/en/resources/roles/curating/)
- [Subgraph Studio Pricing](https://thegraph.com/studio-pricing/)
- [CoinGecko — GRT price](https://www.coingecko.com/en/coins/the-graph)
- [Arbiscan gas tracker](https://arbiscan.io/gastracker) · [Arbitrum gas docs](https://docs.arbitrum.io/how-arbitrum-works/deep-dives/gas-and-fees) · [Arbitrum cost estimator](https://gas.arbitrum.io/)
- [Goldsky pricing](https://goldsky.com/pricing) · [Chainstack — top hosted subgraph platforms 2026](https://chainstack.com/top-5-hosted-subgraph-indexing-platforms-2026/)
