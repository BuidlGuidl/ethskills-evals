## system: init (model claude-opus-5)

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

## system: thinking_tokens (model ?)

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
{"command":"pwd && ls -la","description":"Check working directory contents"}
```

### tool_result
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/indexing-quiz-002/2026-08-19T033808Z-claude-no-skill-2/workspace
total 12
drwxrwxr-x 2 damu damu 4096 ago 19 00:38 .
drwxrwxr-x 3 damu damu 4096 ago 19 00:38 ..
-rw-rw-r-- 1 damu damu 1232 ago 19 00:38 TASK.md

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

### tool_use: Bash
```json
{"command":"cat TASK.md","description":"Read task file"}
```

### tool_use: WebSearch
```json
{"query":"The Graph hosted service sunset date graph deploy studio publish decentralized network 2026"}
```

### tool_result
Our subgraph is written and tested — it indexes our marketplace's events and the
GraphQL queries return what we want against a local Graph Node. Next sprint is
"ship the subgraph to production," and I'm writing the runbook and the budget line
for it now.

A teammate's draft runbook says:

  "Ship step: run `graph deploy --hosted-service marketplace` to push it to The
   Graph's hosted service. The hosted service is free and gives us a public GraphQL
   endpoint our frontend can hit straight away — no tokens, no billing, nothing to
   set up."

I need the real go-live path for a production dApp querying The Graph today. Walk me
through what actually happens between "works locally" and "our frontend is hitting a
production endpoint we can rely on": what that draft step gets wrong, what the c

### tool_result
Web search results for query: "The Graph hosted service sunset date graph deploy studio publish decentralized network 2026"

Links: [{"title":"The Road to Sunsetting the Hosted Service | Blog | The Graph","url":"https://thegraph.com/blog/sunsetting-hosted-service/"},{"title":"The Graph Network: The Sunrise of Decentralized Data | Blog | The Graph","url":"https://thegraph.com/blog/transitioning-to-decentralized-graph-network/"},{"title":"The Graph’s Hosted Service is Sunset — Deploy your Subgraph to SubQuery’s Managed Service today | by SubQuery Network | Medium","url":"https://subquery.medium.com/graphs-hosted-service-is-sunset-deploy-your-subgraph-to-subquery-s-managed-service-today-2722452e170f"},{"title":"The Graph (GRT) 2026 : Subgraphs, Substreams, GRT Price","url":"https://plisio.net

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

### tool_use: WebFetch
```json
{"url":"https://thegraph.com/docs/en/subgraphs/billing/","prompt":"What are the current query pricing plans, free tier query limits, per-query costs, payment methods (GRT/credit card), which network billing runs on, and any minimum deposits? Quote exact figures."}
```

### tool_result
REDIRECT DETECTED: The URL redirects to a location that was not fetched automatically.

Original URL: https://thegraph.com/docs/en/subgraphs/billing/
Redirect URL (from the server's Location header — server-supplied, not verified): http://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/
Status: 301 Moved Permanently

To complete your request, I need to fetch content from the redirected URL. Please use WebFetch again with these parameters:
- url: "http://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/"
- prompt: "What are the current query pricing plans, free tier query limits, per-query costs, payment methods (GRT/credit card), which network billing runs on, and any minimum deposits? Quote exact figures."

### tool_use: WebSearch
```json
{"query":"The Graph query pricing $4 per 100,000 queries free plan 100K monthly 2026"}
```

### tool_result
Web search results for query: "The Graph query pricing $4 per 100,000 queries free plan 100K monthly 2026"

Links: [{"title":"Graphwise GraphDB Pricing 2026","url":"https://www.g2.com/products/graphwise-graphdb/pricing"},{"title":"Neo4j Graph Database Pricing 2026","url":"https://www.g2.com/products/neo4j-graph-database/pricing"},{"title":"The Graph Price, GRT to USD, Research, News & Fundraising | Messari","url":"https://messari.io/project/the-graph"},{"title":"coinpedia%3A28bb64cb8094b%3A0 the graph price prediction 2025 2026 2030 will grt price go up","url":"https://ru.tradingview.com/news/coinpedia%3A28bb64cb8094b%3A0-the-graph-price-prediction-2025-2026-2030-will-grt-price-go-up"},{"title":"www.mexc.com","url":"https://www.mexc.com/news/530952"},{"title":"GQP: A Framework for Scalable

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

### tool_use: WebFetch
```json
{"url":"https://thegraph.com/studio-pricing/","prompt":"List every plan, the free query allowance, per-query or per-100k price, payment methods, rate limits, and any other fees stated. Quote exact figures and any dates/notes."}
```

### tool_use: WebFetch
```json
{"url":"http://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/","prompt":"Summarize: what Subgraph Studio is, free tier query limits, billing/pricing, payment methods (GRT vs credit card), which chain billing is on, publishing to the network, API keys."}
```

### tool_result
# Subgraph Studio Pricing Summary

## Plans & Free Allowance
- **Free tier**: 100,000 monthly queries at no cost
- **Pay-as-you-go**: $2 per 100,000 queries beyond the free allocation

## Key Features (All Plans)
- Unlimited subgraph creation
- Dedicated indexing
- Unlimited testing
- Usage-based billing

## Payment Methods
"Pay with the swipe of a card, or with crypto."

## Example Pricing
The page shows a sample scenario: 300,000 monthly queries would cost $4 (the first 100K free, then 200K at $2 per 100K).

## Supported Networks
Access to "60+ networks" including Ethereum, Arbitrum, Polygon, Solana, Bitcoin, and many others.

## Rate Limits & Other Fees
The page does not specify explicit rate limits or additional fees beyond the per-query pricing model.

## Notes
- No contract or minimu

### tool_result
# Subgraph Studio Summary

**What It Is:**
Subgraph Studio is The Graph's platform for querying subgraphs on The Graph Network, offering two pricing tiers for different user needs.

**Free Tier:**
The Free Plan provides "100,000 free monthly queries with full access to the Subgraph Studio testing environment," designed for hobbyists and experimental projects.

**Billing & Pricing:**
Beyond the free quota, the Growth Plan requires payment. Users can access detailed pricing information at thegraph.com/studio-pricing/.

**Payment Methods:**
Two options are available:
- **Credit/Debit Cards:** Users enter card details directly in Subgraph Studio, with invoices processed monthly
- **GRT Token:** Users deposit Graph Token to their billing balance, enabling automatic invoice payments as long as s

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

### tool_use: WebFetch
```json
{"url":"https://thegraph.com/docs/en/subgraphs/developing/publishing/publishing-a-subgraph/","prompt":"Detail the steps to publish a subgraph to The Graph Network: which chain it publishes to, gas costs, whether curation signal is required, minimum GRT signal amounts, curation tax, and what happens after publishing (indexer pickup, query URL). Quote exact figures and requirements."}
```

### tool_use: WebSearch
```json
{"query":"The Graph publish subgraph Arbitrum curation signal required GRT minimum indexer pickup 2025"}
```

### tool_result
REDIRECT DETECTED: The URL redirects to a location that was not fetched automatically.

Original URL: https://thegraph.com/docs/en/subgraphs/developing/publishing/publishing-a-subgraph/
Redirect URL (from the server's Location header — server-supplied, not verified): http://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/
Status: 301 Moved Permanently

To complete your request, I need to fetch content from the redirected URL. Please use WebFetch again with these parameters:
- url: "http://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/"
- prompt: "Detail the steps to publish a subgraph to The Graph Network: which chain it publishes to, gas costs, whether curation signal is required, minimum GRT signal amounts, curat

### tool_result
Web search results for query: "The Graph publish subgraph Arbitrum curation signal required GRT minimum indexer pickup 2025"

Links: [{"title":"State of The Graph Q2 2025 | Messari","url":"https://messari.io/report/state-of-the-graph-q2-2025"},{"title":"State of The Graph Q3 2025 | Messari","url":"https://messari.io/report/state-of-the-graph-q3-2025"},{"title":"State of The Graph Q1 2025 | Messari","url":"https://messari.io/report/state-of-the-graph-q1-2025"},{"title":"The Graph: index and query Arbitrum data | Arbitrum Docs","url":"https://docs.arbitrum.io/for-devs/third-party-docs/TheGraph"},{"title":"Curating | Docs | The Graph","url":"https://thegraph.com/docs/en/resources/roles/curating/"},{"title":"Quick Start | Docs | The Graph","url":"https://thegraph.com/docs/en/subgraphs/quick-st

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

### tool_use: WebFetch
```json
{"url":"http://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/","prompt":"Give the exact publishing steps and commands, which chain publishing happens on, whether ETH gas is needed, curation/signal guidance and amounts, and what the resulting production query URL looks like. Quote exact text where possible."}
```

### tool_use: WebFetch
```json
{"url":"https://thegraph.com/docs/en/subgraphs/quick-start/","prompt":"Quote the exact CLI commands for deploy and publish, the recommended curation GRT amount, the query URL formats for Studio dev endpoint vs network gateway endpoint, and any statements about free queries or rate limits on the Studio endpoint."}
```

### tool_result
# Publishing a Subgraph to The Graph's Decentralized Network

## Publishing Steps

**From Subgraph Studio:**
1. Navigate to the Subgraph Studio dashboard
2. "Click on the **Publish** button"
3. Your subgraph becomes visible in Graph Explorer

**From CLI (version 0.73.0+):**
Execute: `graph codegen && graph build` followed by `graph publish`. A wallet connection window opens for metadata configuration and deployment.

## Chain & Gas Requirements

Publishing occurs on **Arbitrum One** (or Arbitrum Sepolia for testnet). The documentation states: "All published versions of an existing Subgraph can: Be published to Arbitrum One." The page does not specify ETH gas requirements.

## Curation Signal Guidance

The recommended minimum signal amount is **3,000 GRT**. The documentation advises: "it is

### tool_result
# The Graph Subgraph Quick Start: Key Commands and Information

## Deploy and Publish CLI Commands

**Deploy to Studio:**
```
graph deploy <SUBGRAPH_SLUG>
```

**Publish to Network:**
```
graph publish
```

The documentation also mentions: `"graph codegen && graph build"` as the build commands that precede deployment.

## Curation Signal Recommendation

The guide states: **"Curation with 3,000+ GRT is recommended to incentivize indexing."**

## Query Access and Rate Limits

Regarding free queries on The Graph Network, the documentation specifies: **"You get access to 100,000 free queries/month with your Subgraph on The Graph Network."**

Regarding Studio deployment specifics, the guide notes that a deployed Subgraph in Studio is **"free to use, rate-limited, not visible to the public, and 

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

### tool_use: WebFetch
```json
{"url":"https://thegraph.com/docs/en/subgraphs/querying/introduction/","prompt":"Quote the exact production gateway query URL format(s), how the API key is passed (URL path vs Authorization header), and any guidance about securing API keys (domain allowlists, subgraph restrictions, not exposing in frontend)."}
```

### tool_use: WebFetch
```json
{"url":"https://thegraph.com/docs/en/resources/roles/curating/","prompt":"Quote the curation tax percentage, how signal withdrawal works, bonding curve / risk of loss, and whether curation is required for a subgraph to be indexed. Also mention the upgrade indexer if referenced."}
```

### tool_result
Based on the provided documentation, I cannot provide the specific details you've requested. The page does not include:

- The exact production gateway query URL format
- How API keys are passed (whether via URL path or Authorization header)
- Security guidance about domain allowlists, subgraph restrictions, or frontend exposure risks

The document only mentions that "Each query URL requires a valid API key" and directs users to manage keys in Subgraph Studio, but omits the technical implementation details about key transmission and security best practices you're asking about.

To find this information, you would need to consult the GraphQL API reference guide or Subgraph Studio documentation linked in the "Additional Resources" section.

### tool_result
# Key Curation Information

**Curation Tax:**
"Upon initial curation, a 1% standard tax is incurred." Auto-migrations to new versions cost 0.5%, while manually migrating costs the full 1%.

**Signal Withdrawal:**
Curators can withdraw signaled GRT anytime without cooldown periods, "receiving the entire amount (minus the 1% curation tax)." Unlike delegation, there's no waiting period involved.

**Bonding Curve & Risk of Loss:**
On Ethereum, when curators burn shares to withdraw, "the GRT valuation of the remaining shares will be reduced." This creates risk where remaining curators may only recover a fraction of their initial GRT if others withdraw simultaneously.

**Curation Requirement:**
Curation is not strictly required for indexing. The Sunrise Upgrade Indexer ensures all subgraphs get 

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

### tool_use: WebFetch
```json
{"url":"https://thegraph.com/docs/en/subgraphs/querying/managing-api-keys/","prompt":"Quote what you can configure on an API key: domain/origin allowlists, subgraph restrictions, rate limits, usage viewing. Also any gateway URL format shown."}
```

### tool_result
REDIRECT DETECTED: The URL redirects to a location that was not fetched automatically.

Original URL: https://thegraph.com/docs/en/subgraphs/querying/managing-api-keys/
Redirect URL (from the server's Location header — server-supplied, not verified): http://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/
Status: 301 Moved Permanently

To complete your request, I need to fetch content from the redirected URL. Please use WebFetch again with these parameters:
- url: "http://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/"
- prompt: "Quote what you can configure on an API key: domain/origin allowlists, subgraph restrictions, rate limits, usage viewing. Also any gateway URL format shown."

### tool_use: WebSearch
```json
{"query":"gateway.thegraph.com/api/subgraphs/id query URL format Authorization Bearer api key deprecated path"}
```

### tool_result
Web search results for query: "gateway.thegraph.com/api/subgraphs/id query URL format Authorization Bearer api key deprecated path"

Links: [{"title":"Subgraphs Overview | Uniswap Developers","url":"https://docs.uniswap.org/api/subgraph/overview"},{"title":"The Graph Client Tools | Docs | The Graph","url":"https://thegraph.com/docs/en/subgraphs/querying/graph-client/README/"},{"title":"The Graph - Celo Docs","url":"https://docs.celo.org/tooling/indexers/the-graph"},{"title":"How to Manage API keys | Docs | The Graph","url":"https://thegraph.com/docs/en/subgraphs/querying/managing-api-keys/"},{"title":"Authorization and Authentication | Hive Gateway","url":"https://the-guild.dev/graphql/hive/docs/gateway/authorization-authentication"},{"title":"docs/website/src/pages/en/subgraphs/querying/m

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

### tool_use: WebFetch
```json
{"url":"https://github.com/graphprotocol/docs/blob/main/website/src/pages/en/subgraphs/querying/managing-api-keys.mdx","prompt":"Quote what security settings can be configured on an API key (domain allowlist, subgraph restrictions), and the query URL formats shown."}
```

### tool_use: WebSearch
```json
{"query":"GRT price USD August 2026 The Graph token"}
```

### tool_result
The server returned HTTP 404 Not Found.

The response body was not retrieved. If this URL requires authentication, use an authenticated tool (e.g. `gh` for GitHub, or an MCP-provided fetch tool) instead of WebFetch.

### tool_result
Web search results for query: "GRT price USD August 2026 The Graph token"

Links: [{"title":"The Graph (GRT) Price Prediction 2026 2027 2028 - 2040","url":"https://changelly.com/blog/the-graph-grt-price-prediction/"},{"title":"The Graph price today, GRT to USD live price, marketcap and chart | CoinDesk","url":"https://www.coindesk.com/price/the-graph"},{"title":"The Graph Price, Chart, Market Cap, GRT Coin Essentials | CoinLore","url":"https://www.coinlore.com/coin/the-graph"},{"title":"The Graph price | index, chart and news | WorldCoinIndex","url":"https://www.worldcoinindex.com/coin/the-graph"},{"title":"The Graph (GRT) Price Prediction for 2026, 2030-2040","url":"https://tradersunion.com/currencies/forecast/the-graph/"},{"title":"The Graph Price Prediction August 2026: GRT Outlook","ur

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

### tool_use: WebFetch
```json
{"url":"https://www.coingecko.com/en/coins/the-graph","prompt":"What is the current GRT price in USD and the date/time of the quote?"}
```

### tool_use: WebFetch
```json
{"url":"https://thegraph.com/docs/en/subgraphs/querying/managing-api-keys/","prompt":"What security settings can be configured on an API key (domain allowlist, subgraph restrictions)? Quote the query URL formats shown."}
```

### tool_result
REDIRECT DETECTED: The URL redirects to a location that was not fetched automatically.

Original URL: https://thegraph.com/docs/en/subgraphs/querying/managing-api-keys/
Redirect URL (from the server's Location header — server-supplied, not verified): http://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/
Status: 301 Moved Permanently

To complete your request, I need to fetch content from the redirected URL. Please use WebFetch again with these parameters:
- url: "http://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/"
- prompt: "What security settings can be configured on an API key (domain allowlist, subgraph restrictions)? Quote the query URL formats shown."

### tool_result
# GRT Price Quote

The Graph (GRT) is currently trading at **$0.01309 USD**.

The webpage indicates this pricing data was last updated **today** (August 19, 2026), though no specific timestamp is provided. The quote reflects a 0.1% change in the 24-hour period and is calculated "in real-time by aggregating the latest data across 101 exchanges and 150 markets, using a global volume-weighted average formula."

### tool_use: WebFetch
```json
{"url":"http://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/","prompt":"What security settings can be configured on an API key (domain allowlist, subgraph restrictions, spending limits)? Quote the query URL formats shown and any auth header guidance."}
```

### tool_use: WebSearch
```json
{"query":"Arbitrum One transaction fee cost 2026 average gas price publish contract call cents"}
```

### tool_result
# Security Settings for API Keys

Based on The Graph's documentation, three primary security configurations are available:

## Spending Limits
"Manage spending limit: this is an optional monthly spending limit for a given API key, in USD. This limit is per billing period (calendar month)."

## Domain Allowlist
Users can restrict API key usage to specific domains by navigating to the Security section and adding authorized domain names through the "Add Domain" feature.

## Subgraph Restrictions
API keys can be limited to access only designated subgraphs via the "Assign Subgraphs" option in the Security section of the key's Details page.

## Query URL Formats

The documentation provides two authentication approaches:

**URL-based (direct inclusion):**
```
https://gateway.thegraph.com/api/<YOU

### tool_result
Web search results for query: "Arbitrum One transaction fee cost 2026 average gas price publish contract call cents"

Links: [{"title":"Arbitrum Gas Price | Bitbond","url":"https://tokentool.bitbond.com/gas-price/arbitrum"},{"title":"Arbitrum One Average Gas Price Chart | Arbitrum One","url":"https://arbiscan.io/chart/gasprice"},{"title":"Arbitrum One Gas Tracker","url":"https://www.quicknode.com/gas-tracker/arbitrum-one"},{"title":"Arbitrum One Network Transaction Fee Chart | Arbitrum One","url":"https://arbiscan.io/chart/transactionfee"},{"title":"Gas hub","url":"https://gas-hub.vercel.app/"},{"title":"0.020 Gwei | Arbitrum Gas Tracker | Arbitrum One","url":"https://arbiscan.io/gastracker"},{"title":"Arbitrum One Average transaction fee | Token Terminal","url":"https://tokenterminal.com/

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

### tool_use: WebSearch
```json
{"query":"Goldsky vs Alchemy Subgraphs hosted subgraph pricing 2026 free tier"}
```

### tool_result
Web search results for query: "Goldsky vs Alchemy Subgraphs hosted subgraph pricing 2026 free tier"

Links: [{"title":"Top 5 hosted Subgraph indexing platforms in 2026 | Chainstack Blog","url":"https://chainstack.com/top-5-hosted-subgraph-indexing-platforms-2026/"},{"title":"Migrate from Alchemy - Comparison - Goldsky Docs","url":"https://docs.goldsky.com/subgraphs/migrate-from-alchemy/comparison"},{"title":"Best Blockchain Indexers Compared (2026) — The Graph, Envio, Subsquid | indexer.ink","url":"https://indexer.ink/"},{"title":"Subgraph Studio Alternatives 2026 - BLOG.BLOCKXS","url":"https://blog.blockxs.com/subgraph-studio-alternatives-2026/"},{"title":"What is a subgraph? (2023 Guide) | Alchemy","url":"https://www.alchemy.com/overviews/what-is-a-subgraph"},{"title":"Subgraphs - Goldsk

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

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

### tool_use: Bash
```json
{"command":"cat > answer.md <<'MDEOF'\n# Shipping the subgraph: the real go-live path (and what it costs)\n\n**Written 2026-08-19.** Every figure below has a source and a \"re-check before you\ncommit it\" flag. Crypto-denominated numbers (GRT, gas) move daily; the USD query\nprice is a posted list price and has changed at least once historically.\n\n---\n\n## 1. What the draft runbook gets wrong\n\nThe draft step is:\n\n> `graph deploy --hosted-service marketplace` … \"The hosted service is free and gives\n> us a public GraphQL endpoint our frontend can hit straight away — no tokens, no\n> billing, nothing to set up.\"\n\nFive separate problems:\n\n**(a) The hosted service no longer exists.** The Graph retired it on **June 12, 2024**\nas the final (\"Sunrise\") phase of the *Sunrise of Decentralized Data* migration.\nThe endpoints are dead and the `--hosted-service` flag is gone from the CLI. This\ncommand will not fail with a billing error — it will fail as an unrecognised\nflag/unknown target. Anything in the runbook downstream of it is untested.\n*Source: [The Graph — Sunsetting the Hosted Service](https://thegraph.com/blog/sunsetting-hosted-service/), [The Sunrise of Decentral
```

### tool_result
281 answer.md

### assistant
Written to `answer.md`. The short version:

**The draft step is dead code.** The hosted service was retired **June 12, 2024** (final "Sunrise" phase); the `--hosted-service` flag no longer exists. It also gets four other things wrong: deploy and publish are now separate steps, it isn't free at your volume, publishing *is* an on-chain transaction, and there is no anonymous public endpoint — every gateway query needs an API key.

**The real path** is three phases: `graph deploy <slug>` → Subgraph Studio (free, rate-limited, explicitly dev/staging only) → verify sync → `graph publish`, which is a wallet transaction on **Arbitrum One** → create and lock down an API key → wire the frontend through a server-side proxy.

**Money:**
- **One-time ~$50**, dominated by the recommended 3,000 GRT self-signal (~$39 at GRT $0.01309 today). Plus Arbitrum gas, likely under $1 — budget $5–10. The signal is ~99% recoverable (1% curation tax burned), so book it as an at-risk deposit, not an expense. You can also skip it: the Sunrise Upgrade Indexer indexes published subgraphs regardless; the signal buys redundancy.
- **Monthly: 100K free queries, then $2 per 100,000.** At 3M queries that's **$58/mo**; at 5M, $98. Payable **by credit card** — which keeps tokens out of your recurring spend entirely, likely the detail your finance team cares about most.

**Two things I'd flag hardest for the budget:** the GRT price (most volatile number on the page, re-price the day you buy) and your actual query count — the $2 rate is easy, but an unmemoized hook or a polling interval can 10x the denominator. Instrument the frontend against the Studio endpoint for a day before committing a number, and set the API key's monthly USD spend limit to ~2x your budget as a hard stop.

Also worth noting: the $2/100K rate was **$4/100K** historically, so it demonstrably changes — re-read the pricing page at commit time. And the frontend proxy work is a real sprint item the draft omits; the docs explicitly say not to expose the key client-side.

## result: success — turns 25, 262651ms, cost $1.108768
