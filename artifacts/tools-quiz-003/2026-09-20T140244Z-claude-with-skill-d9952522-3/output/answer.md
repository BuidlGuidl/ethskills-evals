# Giving a wallet-Q&A agent structured on-chain data

## The short answer

Wire the agent to the **Blockscout MCP server** at `https://mcp.blockscout.com/mcp`
(Streamable HTTP transport). Don't scrape the explorer's HTML, and don't hand-decode
raw RPC responses — Blockscout already indexes and decodes everything you need
(transactions, token transfers, balances, contract metadata) and exposes it over MCP,
which is the agent-native interface.

## Why this one

- **It's addressed as a tool, not as a webpage.** The agent calls MCP tools and gets
  back structured JSON — no HTML parsing, no selectors that break on the next explorer
  redesign, no babysitting.
- **Decoding is already done.** Token transfers come back as transfers with token
  symbol/decimals/amount, not as raw `Transfer` logs you have to ABI-decode yourself.
- **Multi-chain by parameter.** You pass a chain id per call rather than standing up a
  separate integration per network.
- **It's hosted.** Nothing to run or index yourself for a read-only Q&A agent.

## How the agent addresses it

Register it as an MCP server in your agent's config. For a Claude-based agent
(`.mcp.json` / Claude Code / Agent SDK):

```json
{
  "mcpServers": {
    "blockscout": {
      "type": "http",
      "url": "https://mcp.blockscout.com/mcp"
    }
  }
}
```

The Anthropic Messages API can also reach it directly via the MCP connector by
pointing at the same URL, so the server is shared between your local dev loop and
production.

Once connected, the flow per user question is:

1. Resolve the chain the user means to a chain id (the server exposes a chain-list
   tool for this — call it rather than hardcoding a map).
2. Call the address-oriented tools for that `(address, chain_id)`: address info /
   balances, token holdings, transactions, token transfers.
3. Let the model summarize the returned JSON.

**Discover the tool names at runtime, don't hardcode them from memory.** Do an MCP
`tools/list` against the endpoint (or let your client list them) and read the actual
input schemas — argument names and pagination shapes are live data and have changed
between server versions. Blockscout also asks clients to call its instructions/init
tool first; follow whatever the server's own tool descriptions say.

Quick reachability check (returns `200` today, 2026-09-20):

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://mcp.blockscout.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{
        "protocolVersion":"2024-11-05","capabilities":{},
        "clientInfo":{"name":"wallet-agent","version":"1"}}}'
```

## When to drop down to REST instead

Use the **Blockscout REST API** (`https://<chain-instance>.blockscout.com/api/v2/...`,
e.g. `/api/v2/addresses/{hash}/transactions`, `/token-transfers`, `/token-balances`)
when:

- **your application code is the consumer**, not the model — e.g. you're pre-fetching a
  wallet summary on page load, running a cron job, or caching results outside the agent
  loop; or
- MCP isn't available in your runtime (no MCP client in that language/framework), or you
  need a self-hosted Blockscout instance for a chain the public MCP server doesn't cover.

Same indexed, decoded data — just a different consumer. The rule either way: use an
indexed interface. Scraping explorer HTML or decoding raw logs by hand is the thing to
avoid.

## Practical notes

- Cache per `(address, chain_id)` for a short TTL; wallet pages are re-asked about a lot
  and the hosted server is a shared resource.
- Responses are paginated — have the agent stop at the first page for "recent activity"
  questions instead of walking full history into the context window.
- Keep an RPC client around only for the things an indexer genuinely can't answer
  (pending mempool state, `eth_call` simulation against head).
