# Structured on-chain data for a wallet-Q&A agent

## Recommendation: the Blockscout MCP server

**Endpoint:** `https://mcp.blockscout.com/mcp`

Wire your agent to this as a Model Context Protocol server. It is a hosted MCP
endpoint that exposes blockchain data as tools an LLM can call directly — no
HTML scraping, no hand-decoding of raw JSON-RPC.

What it gives you, which maps exactly onto your use case:

- Address and transaction queries (a wallet's recent transactions)
- Token info and token balances
- Smart contract interaction helpers
- Multi-chain support, so "a couple of chains" is a parameter, not a second integration
- A response shape deliberately designed for LLM consumption, rather than for a
  block-explorer web page

This is the reason to prefer it over the two alternatives you already rejected:
scraping Etherscan means babysitting markup that changes under you, and raw
`eth_getLogs` / `eth_getTransactionReceipt` output hands you hex blobs and
undecoded topics that you'd then have to ABI-decode and enrich with token
metadata yourself. Blockscout MCP has already done the decoding, the token
lookup, and the pagination.

## How the agent addresses it

It's a remote MCP server over HTTP, so the agent connects as an MCP client and
the server's tools appear in the agent's tool list automatically — the agent
calls them by name with an address and a chain, the same way it calls any other
tool. There's nothing to deploy and no scraper to maintain.

For Claude Code, register it as a remote MCP server:

```bash
claude mcp add --transport http blockscout https://mcp.blockscout.com/mcp
```

For your own agent built on the Claude API / Agent SDK, point your MCP client
configuration at the same URL; the SDK handles tool discovery and dispatch, so
your agent code never touches an HTTP client for chain data.

## Round it out

- **Contract exploration on the fly:** if the agent (or you, while debugging)
  hits an unfamiliar contract, https://abi.ninja — paste a verified address and
  get a working UI for every function, multi-chain, zero setup. CLI equivalent:
  `cast interface <address>`.
- **Fallback / cross-check:** the Etherscan-family APIs (`api.etherscan.io`,
  and the Etherscan-compatible APIs on Arbiscan, Basescan, Optimistic
  Etherscan) are the reasonable second source if you need a field Blockscout
  doesn't expose. Use the API, never the HTML.
- **If the agent ever needs to write** (sign and send), that's a separate path:
  Foundry's `cast send`, or viem in-process. Keep reads and writes on separate
  rails.
- **MCP servers compose**, so you can add `eth-mcp` or a protocol-specific
  server later without disturbing the Blockscout wiring.

## One caveat worth stating

Blockscout MCP is recent infrastructure (established around Feb 2026), and it's
a hosted third-party dependency — your agent's read path is only as available
as that endpoint. Before going to production, confirm the chains you care about
are covered, check the rate limits for your query volume, and keep the
Etherscan-compatible API path as a documented fallback so a Blockscout outage
degrades your agent rather than breaking it.
