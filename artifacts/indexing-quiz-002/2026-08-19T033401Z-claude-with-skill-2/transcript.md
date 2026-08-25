## system: init (model claude-opus-5)

### assistant
I'll start by loading the indexing skill, since this is squarely a "deploying a subgraph" question.

### tool_use: Skill
```json
{"skill":"indexing"}
```

### tool_result
Launching skill: indexing

### user
Base directory for this skill: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/indexing-quiz-002/2026-08-19T033401Z-claude-with-skill-2/workspace/.claude/skills/indexing

# Onchain Data and Indexing

Historical onchain data comes from an indexer, never from a scan at request time. Public RPCs cap each `eth_getLogs` call by block span and by matched-log count, so a full-history scan is thousands of paginated calls that grow with every block and fail on rate limits, timeouts or credits. Back a feed, streak, ranking or dashboard with a one-time backfill into a persistent indexed store that then tails new events — a subgraph, Ponder, a provider data API, or your own indexer. Rebuilding past state from archive-node reads is the same mistake in another shape.

Design contracts event-first: every state change emits an event carrying what the read side needs, because a change with no event is invisible to every indexer, frontend and explorer. Keep aggregation, ranking and pagination offchain; if a result must be committed onchain, store a hash.

Current state is not indexing work. Balances, allowances, ownership and other "as of now" reads are direct contract calls, batched into one request with Multicall3 (`0xcA11bde05977b3631167028862bE2a173976CA11`, same address on most chains) or a provider balances endpoint. Do not build or operate a subgraph to track a number the chain returns on request.

The read side is not designed until its production home is named. Decide where the indexer runs in production and by which command or service, and write that down next to the architecture — this is the decision that silently stays open, leaving a read side that only ever ran on a laptop.

On The Graph, deploying is not publishing, and the free hosted service is gone (sunset June 2024), so there is no free public endpoint to deploy to:

```bash
graph init <slug>          # then codegen/build
graph auth <deploy-key>
graph deploy <slug>        # -> Subgraph Studio: testing only
```

Publish the subgraph from Studio to the network to get the production endpoint, and query it with a Studio API key. Production queries are metered: about 100K free per month, then about $2 per 100K (checked 2026-08-18 — re-read the live pricing page before quoting a budget). Self-hosting a Graph Node or a Ponder process is a fine alternative, but then the host, the persistent store and the process supervision are yours to name.

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

### tool_use: ToolSearch
```json
{"query":"select:WebSearch,WebFetch","max_results":2}
```

### tool_result
[{"type":"tool_reference","tool_name":"WebSearch"},{"type":"tool_reference","tool_name":"WebFetch"}]

### tool_use: Bash
```json
{"command":"pwd && ls -a","description":"List working directory contents"}
```

### tool_result
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/indexing-quiz-002/2026-08-19T033401Z-claude-with-skill-2/workspace
.
..
.agents
.claude
TASK.md

## system: thinking_tokens (model ?)

### tool_use: WebSearch
```json
{"query":"The Graph Network subgraph query pricing per 100,000 queries 2026"}
```

### tool_use: WebSearch
```json
{"query":"The Graph hosted service sunset June 2024 migrate to Subgraph Studio decentralized network"}
```

### tool_result
Web search results for query: "The Graph Network subgraph query pricing per 100,000 queries 2026"

Links: [{"title":"Top 5 hosted Subgraph indexing platforms in 2026 | Chainstack Blog","url":"https://chainstack.com/top-5-hosted-subgraph-indexing-platforms-2026/"},{"title":"Subgraph Studio Pricing | The Graph","url":"https://thegraph.com/studio-pricing/"},{"title":"The Graph (GRT) 2026 : Subgraphs, Substreams, GRT Price","url":"https://plisio.net/crypto/the-graph-grt"},{"title":"State of The Graph Q1 2025 | Messari","url":"https://messari.io/report/state-of-the-graph-q1-2025"},{"title":"State of The Graph Q3 2025 | Messari","url":"https://messari.io/report/state-of-the-graph-q3-2025"},{"title":"Network Deployment Cost Comparison | SubQuery Documentation","url":"https://subquery.network/doc/

### tool_result
Web search results for query: "The Graph hosted service sunset June 2024 migrate to Subgraph Studio decentralized network"

Links: [{"title":"The Road to Sunsetting the Hosted Service | Blog | The Graph","url":"https://thegraph.com/blog/sunsetting-hosted-service/"},{"title":"The Graph's Hosted Service is Sunset - Deploy your Subgraph to SubQuery’s Managed Service today","url":"https://blog.subquery.network/graphs-hosted-service-is-sunset-deploy-your-subgraph-to-subquerys-managed-service-today/"},{"title":"SubQuery Blog The Graph's Hosted Service is Sunset - Deploy your Subgraph to SubQuery’s Managed Service today","url":"https://subquery.network/blog/graphs-hosted-service-is-sunset-deploy-your-subgraph-to-subquerys-managed-service-today"},{"title":"How to Migrate Hosted Subgraphs to the Gr

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

### tool_use: WebFetch
```json
{"url":"https://thegraph.com/studio-pricing/","prompt":"List exactly the pricing tiers/plans, the free query allowance, the price per query or per 100k queries, any monthly minimum or subscription fee, payment methods (credit card, GRT, USDC), and any dates/notes on the page."}
```

### tool_use: WebFetch
```json
{"url":"https://thegraph.com/docs/en/subgraphs/billing/","prompt":"Summarize: how billing works, free tier size, price per query, what token/network is used for payment (GRT/Arbitrum/credit card), whether credit card payments are supported, and any minimum deposits."}
```

### tool_result
REDIRECT DETECTED: The URL redirects to a location that was not fetched automatically.

Original URL: https://thegraph.com/docs/en/subgraphs/billing/
Redirect URL (from the server's Location header — server-supplied, not verified): http://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/
Status: 301 Moved Permanently

To complete your request, I need to fetch content from the redirected URL. Please use WebFetch again with these parameters:
- url: "http://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/"
- prompt: "Summarize: how billing works, free tier size, price per query, what token/network is used for payment (GRT/Arbitrum/credit card), whether credit card payments are supported, and any minimum deposits."

### tool_result
# Subgraph Studio Pricing Summary

## Pricing Structure
- **Free Tier**: 100,000 monthly queries at no cost
- **Pay-as-You-Go**: $2 per 100,000 queries beyond the free allowance

## Example Cost
The page displays that accessing 300,000 queries monthly costs $4 (the first 100K free, then 200K at $2 per 100K).

## Features Included
- Unlimited subgraph creation
- Dedicated indexing
- Unlimited testing
- Usage-based billing model

## Payment Methods
The page indicates users can "pay with the swipe of a card, or with crypto," though specific payment options (credit card, GRT, USDC) are referenced but not detailed in the main pricing section.

## Network Support
Access to 60+ blockchain networks including Ethereum, Arbitrum, Polygon, Solana, Bitcoin, and others.

## Additional Notes
- No monthl

### tool_use: WebFetch
```json
{"url":"https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/","prompt":"Summarize: billing mechanics, free tier, price per query, payment via credit card vs GRT/USDC on Arbitrum, API key creation, rate limits, and the difference between deploying to Studio and publishing to the network."}
```

### tool_use: WebSearch
```json
{"query":"The Graph docs publishing a subgraph to the network Arbitrum gas curation signal optional 2026"}
```

### tool_result
# Subgraph Studio Billing Summary

## Billing Mechanics
The Graph Network operates on a usage-based billing model through Subgraph Studio. Invoices are processed monthly, and users are "only charged for what you use" with the ability to withdraw unused balances anytime.

## Free Tier
The Free Plan provides "100,000 free monthly queries with full access to the Subgraph Studio testing environment," designed for hobbyists and small projects.

## Price Per Query
The documentation does not specify a per-query price. Users are directed to reference pricing details elsewhere, with suggestions to estimate usage based on application size.

## Payment Methods
**Credit Card:** Direct payment processed monthly for queries exceeding the free quota.

**GRT (The Graph Token):** Primary cryptocurrency pay

### tool_result
Web search results for query: "The Graph docs publishing a subgraph to the network Arbitrum gas curation signal optional 2026"

Links: [{"title":"L2 Transfer Tools FAQ | Docs | The Graph","url":"https://thegraph.com/docs/en/archived/arbitrum/l2-transfer-tools-faq/"},{"title":"Publishing a Subgraph to the Decentralized Network | Docs | The Graph","url":"https://thegraph.com/docs/en/subgraphs/developing/publishing/publishing-a-subgraph/"},{"title":"The Graph’s New Era of Scalability: Arbitrum and L2 Transfer Tools | Blog | The Graph","url":"https://thegraph.com/blog/the-graph-L2-scaling-with-arbitrum/"},{"title":"L2 Transfer Tools Guide | Docs | The Graph","url":"https://thegraph.com/docs/en/arbitrum/l2-transfer-tools-guide/"},{"title":"Quick Start | Docs | The Graph","url":"https://thegraph

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

### tool_use: WebFetch
```json
{"url":"https://thegraph.com/docs/en/subgraphs/developing/publishing/publishing-a-subgraph/","prompt":"Extract the exact steps to publish a subgraph to the decentralized network: what wallet/network/gas is needed, whether curation signal is required or recommended and how much GRT, the role of the Upgrade Indexer, and what changes about the query URL after publishing."}
```

### tool_result
REDIRECT DETECTED: The URL redirects to a location that was not fetched automatically.

Original URL: https://thegraph.com/docs/en/subgraphs/developing/publishing/publishing-a-subgraph/
Redirect URL (from the server's Location header — server-supplied, not verified): http://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/
Status: 301 Moved Permanently

To complete your request, I need to fetch content from the redirected URL. Please use WebFetch again with these parameters:
- url: "http://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/"
- prompt: "Extract the exact steps to publish a subgraph to the decentralized network: what wallet/network/gas is needed, whether curation signal is required or recommended and how m

### tool_use: WebFetch
```json
{"url":"https://thegraph.com/docs/en/subgraphs/quick-start/","prompt":"Extract the exact CLI commands and steps from init to production: graph init, graph auth, graph deploy, publish, API key. Quote the commands verbatim and note the Studio vs network query URL formats."}
```

### tool_result
# The Graph Subgraph CLI Commands: Init to Production

## Key CLI Commands

**Initialize Subgraph:**
```
graph init
```

**Build Subgraph:**
```
graph codegen && graph build
```

**Authenticate for Deployment:**
```
graph auth <DEPLOY_KEY>
```

**Deploy to Studio:**
```
graph deploy <SUBGRAPH_SLUG>
```

**Publish to Network:**
```
graph publish
```

## Query URL Formats

**Studio (Testing/Staging):** Accessed through Subgraph Studio dashboard after deployment—rate-limited and not publicly visible.

**Graph Network (Production):** Obtained from Graph Explorer after publishing—publicly queryable with "100,000 free queries/month."

## Critical Workflow Notes

The documentation distinguishes two paths: Studio approach (steps 5-8) uses the dashboard for publishing, while CLI approach (Path 2) u

### tool_use: WebFetch
```json
{"url":"http://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/","prompt":"Extract: exact publishing steps, which chain the publish tx happens on and gas token, whether curation signal is required or optional and the recommended GRT amount, the role of the Upgrade Indexer, and the production query URL format vs the Studio dev URL."}
```

### tool_use: WebSearch
```json
{"query":"GRT price USD August 2026"}
```

### tool_result
Web search results for query: "GRT price USD August 2026"

Links: [{"title":"The Graph (GRT) Price Prediction 2026 2027 2028 - 2040","url":"https://changelly.com/blog/the-graph-grt-price-prediction/"},{"title":"The Graph (GRT) Price Prediction for 2026, 2030-2040","url":"https://tradersunion.com/currencies/forecast/the-graph/"},{"title":"The Graph Price Prediction August 2026: GRT Outlook","url":"https://www.coingabbar.com/en/price-prediction/the-graph-price-prediction-august-2026"},{"title":"The Graph Price Prediction 2026, 2027 - 2030: Will GRT Price Go Up?","url":"https://coinpedia.org/price-prediction/the-graph-grt-price-prediction/"},{"title":"GRT / TetherUS Price Today — GRTUSDT Chart — TradingView","url":"https://www.tradingview.com/symbols/GRTUSDT/"},{"title":"GRT USD Binance Histo

### tool_result
# Publishing a Subgraph to The Graph Network: Key Details

## Publishing Steps

**From Subgraph Studio:**
1. Access the Subgraph Studio dashboard
2. Click the "Publish" button
3. Your Subgraph appears in Graph Explorer

**From CLI (v0.73.0+):**
Run `graph codegen && graph build` then `graph publish`, which opens a wallet connection interface for metadata addition and deployment.

## Blockchain and Gas Information

The documentation specifies that subgraphs publish to **Arbitrum One** (or Arbitrum Sepolia for testnet), though it notes subgraphs can "Index data on any of the supported networks, regardless of the network on which the Subgraph was published." However, the document does not specify the gas token or provide gas cost details.

## Curation Signal Requirements

Signal is **optional

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

### tool_use: WebFetch
```json
{"url":"https://api.coingecko.com/api/v3/simple/price?ids=the-graph&vs_currencies=usd","prompt":"Report the raw JSON, i.e. the USD price of the-graph (GRT)."}
```

### tool_result
Based on the provided JSON data, the USD price of The Graph (GRT) is **$0.01308737**.

The raw JSON shows: `{"the-graph":{"usd":0.01308737}}`

### tool_use: WebFetch
```json
{"url":"https://thegraph.com/docs/en/subgraphs/querying/introduction/","prompt":"Extract the exact production gateway query URL format(s) for a published subgraph, how the API key is passed (in URL path or Authorization header), and any notes on API key security, domain restrictions, or rate limits."}
```

### tool_use: WebFetch
```json
{"url":"https://thegraph.com/docs/en/resources/roles/curating/","prompt":"Extract: the curation tax percentage charged when signalling GRT, whether signal can be withdrawn, the bonding curve behaviour on Arbitrum, and any risk warnings about losing value when unsignalling."}
```

### tool_result
# The Graph Subgraph Query URL Format

Based on the documentation provided, I can only offer limited information about the production gateway query URL:

## Query URL Details

The page confirms that **"Each Subgraph published to The Graph Network has a unique query URL in Graph Explorer to make direct queries."** However, the specific URL format pattern is not disclosed in this document.

## API Key Management

The documentation indicates that **"Each query URL requires a valid API key"** which must be created or managed through Subgraph Studio. However, the exact method of passing the API key—whether via URL parameter, Authorization header, or another mechanism—is not specified in this content.

## What's Missing

This page does not contain details regarding:
- The exact production gatewa

### tool_result
# The Graph Curation: Tax, Withdrawal, and Risks

**Curation Tax Percentage:**
When signaling GRT on a Subgraph, "a 1% standard tax is incurred" upon initial curation. For auto-migrating signals, an additional "0.5% curation tax on every migration" applies.

**Signal Withdrawal:**
Curators retain the ability to withdraw their signaled GRT at any time. The documentation states: "you will not have to wait for a cooldown period and will receive the entire amount (minus the 1% curation tax)." No extended waiting period is required.

**Bonding Curve Behavior on Arbitrum:**
The document explicitly addresses Arbitrum: "As a Curator on Arbitrum, you are guaranteed to get back the GRT you initially deposited (minus the tax)." This represents a guaranteed mechanism on this network.

**Value Loss Ris

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

### tool_use: WebSearch
```json
{"query":"gateway.thegraph.com/api/subgraphs/id query URL format API key Authorization header docs"}
```

### tool_use: WebFetch
```json
{"url":"https://thegraph.com/docs/en/subgraphs/querying/managing-api-keys/","prompt":"Describe API key management: how to create keys, domain/subgraph restrictions, rate limits, and any security guidance about exposing keys in a frontend."}
```

### tool_result
REDIRECT DETECTED: The URL redirects to a location that was not fetched automatically.

Original URL: https://thegraph.com/docs/en/subgraphs/querying/managing-api-keys/
Redirect URL (from the server's Location header — server-supplied, not verified): http://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/
Status: 301 Moved Permanently

To complete your request, I need to fetch content from the redirected URL. Please use WebFetch again with these parameters:
- url: "http://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/"
- prompt: "Describe API key management: how to create keys, domain/subgraph restrictions, rate limits, and any security guidance about exposing keys in a frontend."

### tool_result
Web search results for query: "gateway.thegraph.com/api/subgraphs/id query URL format API key Authorization header docs"

Links: [{"title":"docs/website/src/pages/en/subgraphs/querying/managing-api-keys.mdx at main · graphprotocol/docs","url":"https://github.com/graphprotocol/docs/blob/main/website/src/pages/en/subgraphs/querying/managing-api-keys.mdx"},{"title":"How to Manage API keys | Docs | The Graph","url":"https://thegraph.com/docs/en/subgraphs/querying/managing-api-keys/"},{"title":"Querying from an Application | Docs | The Graph","url":"https://thegraph.com/docs/en/subgraphs/querying/from-an-application/"},{"title":"Welcome to the Token API | Docs | The Graph","url":"https://thegraph.com/docs/en/token-api/quick-start/"},{"title":"Rock-solid SMS Gateway","url":"https://gatewayapi.co

### tool_use: WebFetch
```json
{"url":"http://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/","prompt":"Describe: how to create API keys, the query URL format, domain restrictions / allowed subgraph restrictions, rate limits, and security guidance about exposing keys in a browser frontend."}
```

### tool_use: WebSearch
```json
{"query":"\"graph deploy\" CLI \"hosted service\" flag removed error 2025 subgraph studio deploy key"}
```

### tool_result
# Managing API Keys in The Graph

## Creating API Keys

To generate a new key, access [Subgraph Studio](https://thegraph.com/studio/), navigate to the API Keys tab, and click "Create API Key." You'll enter a name and optionally set a spending limit before confirming creation.

## Query URL Format

API keys enable two integration methods:

1. **Direct URL inclusion** (recommended for subgraphs):
   `https://gateway.thegraph.com/api/<YOUR_API_KEY>/subgraphs/id/<SUBGRAPH_ID>`

2. **Authorization header** (enhanced security):
   `Authorization: Bearer <YOUR_API_KEY>`

## Security Restrictions

The platform supports two critical security features:

**Domain Restrictions:** Navigate to your API key's Security section, click "Add Domain," and specify authorized domain names to restrict access geo

### tool_result
Web search results for query: ""graph deploy" CLI "hosted service" flag removed error 2025 subgraph studio deploy key"

Links: [{"title":"Quick Start | The Graph Academy","url":"https://docs.thegraph.academy/official-docs/developer/quick-start"},{"title":"Deploying Using Subgraph Studio | Docs | The Graph","url":"https://thegraph.com/docs/en/subgraphs/developing/deploying/using-subgraph-studio/"},{"title":"Deploy a Subgraph to the Hosted Service | Graph Codex","url":"https://codex.thegraph.com/repositories-and-documentation/official-documentation/hosted-service/deploy-subgraph-hosted"},{"title":"docs/website/src/pages/en/subgraphs/developing/deploying/using-subgraph-studio.mdx at main · graphprotocol/docs","url":"https://github.com/graphprotocol/docs/blob/main/website/src/pages/en/subgraph

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

### tool_use: WebSearch
```json
{"query":"Goldsky subgraph pricing per month 2026 Alchemy Subgraphs pricing hosted subgraph alternatives"}
```

### tool_result
Web search results for query: "Goldsky subgraph pricing per month 2026 Alchemy Subgraphs pricing hosted subgraph alternatives"

Links: [{"title":"Top 5 hosted Subgraph indexing platforms in 2026 | Chainstack Blog","url":"https://chainstack.com/top-5-hosted-subgraph-indexing-platforms-2026/"},{"title":"SQD vs Goldsky: Which Blockchain Data Platform to Choose? [2026]","url":"https://sqd.dev/compare/sqd-vs-goldsky/"},{"title":"Pricing - Goldsky Docs","url":"https://docs.goldsky.com/pricing/summary"},{"title":"Pricing - Goldsky","url":"https://goldsky.com/pricing"},{"title":"Goldsky Reviews - 2026","url":"https://slashdot.org/software/p/Goldsky/"},{"title":"Goldsky Reviews & Pricing 2026 | Goodfirms","url":"https://www.goodfirms.co/software/goldsky"}]

Based on the search results, here's the p

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

### assistant
Research done. Writing the answer file.

### tool_use: Bash
```json
{"command":"cat > /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/indexing-quiz-002/2026-08-19T033401Z-claude-with-skill-2/workspace/answer.md <<'EOF'\n# Shipping the marketplace subgraph to production\n\n_Written 2026-08-19. Every figure below has a source and a \"re-check before you commit it\"\nflag. Prices and GRT quotes move; the process doesn't._\n\n---\n\n## TL;DR for the runbook and the budget line\n\n- **The draft ship step is not runnable.** The Graph's hosted service was shut down on\n  **June 12, 2024**. There is no `--hosted-service` target, no free public endpoint, and no\n  \"no tokens\" path. That whole sentence needs to be replaced.\n- **The real path has two distinct steps that the draft collapses into one:** `graph deploy`\n  (→ Subgraph Studio, a private, rate-limited *testing* endpoint) and **publish** (an onchain\n  transaction on Arbitrum One that puts the subgraph on the network and gives you the\n  production endpoint).\n- **Queries are metered.** 100,000 free per month, then **$2 per 100,000**.\n- **Budget:** stand-up is roughly **$40–$100 one-time-ish** (mostly recoverable curation\n  signal + a few dollars of Arbitrum gas). At **3M queries/month
```

### tool_result
344 /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/indexing-quiz-002/2026-08-19T033401Z-claude-with-skill-2/workspace/answer.md

### assistant
Written to `answer.md`. The short version:

**The draft step can't run.** The Graph's hosted service was decommissioned **June 12, 2024** — there's no `--hosted-service` target, no free public endpoint, and "no tokens, no billing" is wrong on every count. Any doc or answer still recommending it predates mid-2024.

**The step it collapses.** `graph deploy` puts you in **Subgraph Studio** — private, rate-limited, testing only. Getting a production endpoint requires a *separate* **publish**, which is an **onchain transaction on Arbitrum One** needing a funded wallet. Deploying is not publishing.

**The security bug hiding in "hit it straight away."** The production gateway needs an API key, and The Graph's docs say explicitly not to expose it client-side. So the frontend can't talk to it the way it talked to your local Graph Node — you need a thin server-side proxy (~1 engineer-day), or a domain-restricted + spend-capped key as a deliberate tradeoff. Worth putting on the sprint board now rather than discovering in week 2.

**Money:**
- Stand-up: **~$40**, of which ~$39 is a *recoverable* 3,000 GRT curation deposit (1% tax on entry; guaranteed returnable on Arbitrum). Publish gas is a few dollars. True burn: **$1–$5**.
- Running: 100K free/month, then **$2/100K** → **$58/mo at 3M queries**, $98 at 5M.

**Where your budget will actually go wrong:** not the rate — the *query count*. 3M/month is ~1.2 queries/sec sustained, and React Query/Apollo default refetch-on-focus routinely multiplies naive estimates by 3–10×. Instrument before committing, cache at the proxy, and **set a spending limit on the API key** so a polling bug is a $50 incident.

**Re-check before committing:** the GRT price above all (I used $0.01309, live from CoinGecko today — most volatile input); your real query volume; the $2/100K rate on the live pricing page (one search result said "$1.5–2", the official page says $2, I used $2); and my Arbitrum gas range, which is an estimate, not a measurement. The alternative-provider figures (Goldsky/Ormi/Chainstack/SubQuery) came from a third-party comparison blog and are flagged as unverified — price them at the vendor if you shortlist one.

The file also contains drop-in replacement text for your teammate's runbook step, and a note worth raising separately: **who owns the publishing wallet**, since subgraph ownership on the network is tied to that address. A multisig is the boring correct answer.

## result: success — turns 24, 250495ms, cost $1.0235375
