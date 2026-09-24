# Shipping the marketplace subgraph to production

_Prepared 2026-09-23. Every figure below carries a source; the ones marked **RE-CHECK** move and should be re-verified the week you lock the budget._

---

## 1. What the draft runbook gets wrong

> "run `graph deploy --hosted-service marketplace` … The hosted service is free … no tokens, no billing, nothing to set up."

Three separate errors, one of them fatal:

**(a) The hosted service no longer exists.** The Graph's hosted service (`api.thegraph.com/subgraphs/name/...`) was sunset and has been fully off since **June 12, 2024**. The `--hosted-service` flag is dead; that command cannot produce a production endpoint today. Source: [The Graph — "The Road to Sunsetting the Hosted Service"](https://thegraph.com/blog/sunsetting-hosted-service/) and [The Graph Network: The Sunrise of Decentralized Data](https://thegraph.com/blog/transitioning-to-decentralized-graph-network/).

**(b) "Deploy" is not "publish."** Even on the current stack these are two distinct actions. `graph deploy <SLUG>` pushes to **Subgraph Studio** — a development/staging environment with a rate-limited dev query URL that is explicitly not a production endpoint. Making it production means a second step, `graph publish` (or the Publish button in Studio), which is an **onchain transaction on Arbitrum One**. Source: [Quick Start](https://thegraph.com/docs/en/subgraphs/quick-start/), [Publishing a Subgraph](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/).

**(c) "No tokens, no billing" is wrong on both counts.** Publishing requires a wallet holding **ETH on Arbitrum One** for gas. Querying above the free tier requires a funded billing balance — payable by card, or in **GRT**. And the production endpoint is **API-key gated**, so the frontend cannot "hit it straight away" with a bare public URL. Source: [Subgraph Studio billing/introduction](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/), [Studio Pricing](https://thegraph.com/studio-pricing/).

The one thing the draft gets right: there *is* a meaningful free tier. It's just attached to the decentralized network, not to a hosted service.

---

## 2. The actual go-live path

**Step 0 — Decide the network you're indexing and confirm it's supported.** Studio advertises 60+ networks ([Studio Pricing](https://thegraph.com/studio-pricing/)). Confirm your marketplace's chain is on the supported list before sprint planning — this is a hard gate.

**Step 1 — Create the subgraph in Subgraph Studio** (studio.thegraph.com), connect the deploying wallet. This wallet becomes the subgraph owner; treat it as production infrastructure (hardware wallet or multisig-controlled, not a dev hot key).

**Step 2 — Deploy to Studio and let it sync.**
```bash
graph auth <DEPLOY_KEY>
graph codegen && graph build
graph deploy <SUBGRAPH_SLUG>
```
Studio gives you a **development query URL**. Run your existing test suite against it. This is the moment to catch mainnet-vs-local divergence: reorg handling, contracts deployed at a different start block, events your local fixtures never produced. Budget real sprint time here — historical sync of a marketplace from its deploy block can take hours to days depending on chain and start block.

Useful property: the Upgrade Indexer **pre-syncs subgraphs deployed in Studio**, so a subgraph fully indexed in Studio is fully indexed the instant it's published — no second sync wait at go-live. Source: [Edge & Node Upgrade Indexer](https://thegraph.com/docs/en/subgraphs/upgrade-indexer/).

**Step 3 — Publish to the decentralized network (onchain, Arbitrum One).**
```bash
graph publish
```
Opens a browser flow: connect wallet, add metadata, select network. Costs ETH gas on Arbitrum. You can add GRT curation signal **in the same transaction** to save gas. Source: [Quick Start](https://thegraph.com/docs/en/subgraphs/quick-start/), [Publishing a Subgraph](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/).

**Step 4 — Signal curation (optional, but do it).** Docs: *"It is recommended that you curate your own Subgraph with at least 3,000 GRT in order to attract additional indexers to index your Subgraph."* ([Publishing a Subgraph](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/)). It is **not required for the subgraph to be indexed** — the Sunrise/Upgrade Indexer indexes all published subgraphs. But the Upgrade Indexer is a single indexer run by Edge & Node, it *"does not permanently index Subgraphs,"* and *"support tapers off after you curate."* ([Upgrade Indexer docs](https://thegraph.com/docs/en/subgraphs/upgrade-indexer/), [Post-Sunrise FAQ](https://thegraph.com/docs/en/archived/sunrise/)).

  → **Treat curation as the price of redundancy.** Running an unsignalled production subgraph means one indexer is your entire availability story. For a dApp you want to "rely on," signal.

**Step 5 — Create an API key and wire up the frontend.** Query URL from Graph Explorer, of the form `https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>`. Two operational consequences:
  - **The key is a billable secret.** Don't ship it raw in frontend JS. Either use Studio's per-key domain allowlist / subgraph restrictions, or proxy queries through your own backend. Either way, set a **spend limit on the key** — an unthrottled public key is a runaway-bill vector.
  - Pin the **subgraph ID vs. deployment ID** decision: querying by subgraph ID follows your published versions; querying a specific deployment ID pins immutably. Pick deliberately.

**Step 6 — Fund the billing balance** (card via Stripe, or GRT on Arbitrum; ETH on Arbitrum needed for gas if paying in GRT). Source: [Studio billing](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/).

**Step 7 — Ongoing: versioning.** Schema or mapping changes mean a new `graph deploy` → resync in Studio → `graph publish` a new version → another Arbitrum gas payment. Budget a small recurring gas line, and note that breaking schema changes need a frontend-side rollout plan.

---

## 3. Cost

### Stand-up (one-time)

| Item | Cost | Source / confidence |
|---|---|---|
| Subgraph Studio account, deploys, testing | **$0** — "Unlimited subgraph creation, dedicated indexing, unlimited testing" | [Studio Pricing](https://thegraph.com/studio-pricing/) |
| Publish transaction — Arbitrum One gas | Sub-dollar to low single-digit USD in ETH, gas-dependent | The Graph states L2 publishing is *"much lower gas fees"* ([L2 scaling blog](https://thegraph.com/blog/the-graph-L2-scaling-with-arbitrum/)); the **dollar amount is my estimate from typical Arbitrum gas, not a published figure** — **RE-CHECK** |
| Curation signal (recommended) | **3,000 GRT** ≈ **$50–$80** | GRT amount is from [Publishing a Subgraph](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/). USD conversion at GRT ≈ $0.016–$0.027 (spread across [CoinGecko](https://www.coingecko.com/en/coins/the-graph), [CoinMarketCap](https://coinmarketcap.com/currencies/the-graph/), [CoinDesk](https://www.coindesk.com/price/the-graph), 2026-09-23) — **RE-CHECK, volatile** |

**Realistic stand-up line: under $150.** Note that curation signal is *not* a sunk expense — it's a position you can unsignal and recover, minus a curation tax (I believe ~1% burned on signaling; **RE-CHECK against [Curating docs](https://thegraph.com/docs/en/resources/roles/curating/)** before writing it down). Arbitrum's flat bonding curve means signal/unsignal is at consistent cost ([L2 scaling blog](https://thegraph.com/blog/the-graph-L2-scaling-with-arbitrum/)).

The dominant stand-up cost is **engineering time**, not fees: Studio sync, mainnet validation, key-security plumbing.

### Per month

Published rates ([Studio Pricing](https://thegraph.com/studio-pricing/)):
- First **100,000 queries/month: free**, always, on every plan.
- Beyond that: **$2 per 100,000 queries**, usage-based. Their own worked example: *"300,000 queries = $4/month."*

At your stated "few million queries":

| Monthly queries | Billable (after 100k free) | Cost |
|---|---|---|
| 1,000,000 | 900,000 | **$18** |
| 3,000,000 | 2,900,000 | **$58** |
| 5,000,000 | 4,900,000 | **$98** |
| 10,000,000 | 9,900,000 | **$198** |

**Budget line: ~$60/month at 3M queries; round to $100/month for headroom.** This is noise next to an engineer-hour. The cost risk here is not the rate — it's *query volume estimation*.

### The number most likely to blow up your budget

**Your query count, not the price per query.** A naive React frontend that refetches on every render, polls for liveness, or fans one page view out into six GraphQL calls will multiply your "few million" by 5–10× without anyone noticing. Before committing a number:

1. Instrument the local Graph Node for a week of realistic usage and count queries per session.
2. Multiply by projected MAU × sessions/user.
3. Then apply $2/100k.
4. Mitigate with client-side caching (Apollo/urql normalized cache), sane polling intervals, and batching — each is a direct multiplier on the bill.
5. Set a hard spend cap on the API key so a bug or a scraper can't run up the invoice.

---

## 4. What to change in the draft runbook

Replace the single "Ship step" with:

```
1. studio.thegraph.com → create subgraph (owner wallet = multisig/hardware)
2. graph auth <DEPLOY_KEY>
3. graph codegen && graph build
4. graph deploy <SLUG>          # Studio, free, dev endpoint — NOT production
5. Validate against Studio dev URL on the real chain; wait for full sync
6. graph publish                # onchain, Arbitrum One, costs ETH gas
   └─ add >=3,000 GRT curation signal in the SAME tx (saves gas)
7. Create API key; set domain allowlist + spend limit
8. Frontend → https://gateway.thegraph.com/api/<KEY>/subgraphs/id/<ID>
   (proxy through backend rather than shipping the key in client JS)
9. Fund billing balance (card or GRT on Arbitrum)
```

**Prerequisites to add to the sprint checklist:** a funded Arbitrum wallet (ETH for gas + GRT for signal), a decision on who holds that wallet, and a decision on API-key exposure — none of which the current draft accounts for, because it assumes a tokenless free service that hasn't existed since June 2024.

---

## 5. If you'd rather not run a decentralized subgraph

Worth one line in the runbook as a considered-and-rejected alternative, since your teammate's instinct was "managed and simple":

- **Alchemy Subgraphs / SubQuery managed service** — both absorbed hosted-service refugees and will run your existing subgraph code as a managed product with conventional SaaS billing ([Alchemy migration post](https://www.alchemy.com/blog/sunsetting-the-graphs-hosted-service), [SubQuery](https://blog.subquery.network/graphs-hosted-service-is-sunset-deploy-your-subgraph-to-subquerys-managed-service-today/)). No wallet, no GRT. Their pricing is **not verified here** — get quotes if you go this route.
- **Self-host Graph Node** — you already run one locally. Production means you own Postgres, an archive RPC, reorg handling, and pager duty. Almost certainly more expensive than $60/month once you price the RPC plan and the ops time.
- **Ponder** — TypeScript-first indexer, simpler for a single app, but you host it, so the same ops argument applies.

Given the numbers, the decentralized network at ~$60/month is the cheap option. Keeping the local Graph Node as a staging environment alongside it is worth doing regardless.

---

## Re-check before committing to budget

1. **$2 / 100k queries** and the **100k free tier** — confirm on [thegraph.com/studio-pricing](https://thegraph.com/studio-pricing/) the week you finalize. Rates have changed before.
2. **GRT/USD** for the 3,000 GRT signal — volatile; sources disagreed by ~60% ($0.016 vs $0.027) on 2026-09-23 alone.
3. **The 3,000 GRT recommendation itself** — it's docs guidance, not a protocol minimum, and has been revised.
4. **Arbitrum publish gas in USD** — my estimate, not a published number.
5. **Curation tax %** on signaling — I've stated ~1% from memory; verify in [Curating docs](https://thegraph.com/docs/en/resources/roles/curating/).
6. **Your actual query volume** — the single largest source of budget error.

## Sources

- [The Road to Sunsetting the Hosted Service — The Graph](https://thegraph.com/blog/sunsetting-hosted-service/)
- [The Graph Network: The Sunrise of Decentralized Data](https://thegraph.com/blog/transitioning-to-decentralized-graph-network/)
- [Subgraph Studio Pricing](https://thegraph.com/studio-pricing/)
- [Subgraph Studio — billing & introduction](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/)
- [Quick Start](https://thegraph.com/docs/en/subgraphs/quick-start/)
- [Publishing a Subgraph to the Decentralized Network](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/)
- [Edge & Node Upgrade Indexer](https://thegraph.com/docs/en/subgraphs/upgrade-indexer/)
- [Post-Sunrise + Upgrading to The Graph Network FAQ](https://thegraph.com/docs/en/archived/sunrise/)
- [Curating](https://thegraph.com/docs/en/resources/roles/curating/)
- [The Graph's New Era of Scalability: Arbitrum and L2 Transfer Tools](https://thegraph.com/blog/the-graph-L2-scaling-with-arbitrum/)
- [Alchemy — The Graph Hosted Service is Shutting Down](https://www.alchemy.com/blog/sunsetting-the-graphs-hosted-service)
- [SubQuery — Graph's Hosted Service is Sunset](https://blog.subquery.network/graphs-hosted-service-is-sunset-deploy-your-subgraph-to-subquerys-managed-service-today/)
- GRT price: [CoinGecko](https://www.coingecko.com/en/coins/the-graph), [CoinMarketCap](https://coinmarketcap.com/currencies/the-graph/), [CoinDesk](https://www.coindesk.com/price/the-graph) (checked 2026-09-23)
