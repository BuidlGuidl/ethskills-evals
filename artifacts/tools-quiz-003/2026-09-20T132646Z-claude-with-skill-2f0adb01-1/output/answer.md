# Structured on-chain data for a wallet-Q&A agent

**Wire up the Blockscout MCP server: `https://mcp.blockscout.com/mcp`**

That's the short answer. It's a Model Context Protocol server that exposes
blockchain data as tools your agent calls directly — no HTML scraping, no
hand-decoding `eth_getLogs` hex blobs.

## Why this and not the alternatives

- **vs. scraping a block explorer:** the explorer's HTML is a rendering detail
  and will break on you. MCP gives you a stable, typed tool surface.
- **vs. raw JSON-RPC:** RPC has no notion of "this wallet's token transfers."
  You'd be indexing logs, decoding ERC-20 `Transfer` topics, and resolving
  token metadata and decimals yourself. Blockscout has already indexed all of
  that and returns it decoded.
- **vs. the Etherscan API:** perfectly fine as a fallback, but it's a REST API
  you have to wrap in tool definitions, paginate, and normalize per chain
  yourself. MCP hands the agent the tools already described in a form an LLM
  can pick from, and it's multi-chain behind one endpoint.

## What it gives you

Exactly the three things you asked for, already structured:

- transaction history for an address
- token transfers (decoded, with token metadata)
- token and native balances
- plus contract/ABI lookups if the agent needs to explain what a tx did
- multi-chain support through the same endpoint — no second integration for
  your second chain

## How the agent addresses it

It's a remote MCP server over HTTP, so the agent connects as an MCP client and
the tools appear in its tool list. Rough shape of the config, in the usual
`mcpServers` form:

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

In Claude Code specifically:

```bash
claude mcp add --transport http blockscout https://mcp.blockscout.com/mcp
```

If you're building the agent on the Claude API rather than inside Claude Code,
point the MCP connector at the same URL — the server is the same either way.

Then the agent addresses a wallet the obvious way: it calls the address/
transaction/token tools with the wallet address and a chain identifier, and
gets back JSON it can answer from. Your prompt work is about *which* tool to
call and how to summarize, not about parsing.

## Sensible fallbacks

- **Etherscan-family APIs** (`api.etherscan.io`, and the Etherscan-compatible
  APIs at Arbiscan / Basescan / Optimistic Etherscan) if you need something
  Blockscout doesn't index for a given chain. Requires a key and your own
  normalization layer.
- **`cast` from Foundry** for one-off reads the agent needs live from an RPC
  (`cast call`, `cast resolve-name` for ENS) — useful for current state that an
  indexer may lag on.
- **abi.ninja** (https://abi.ninja) for when *you*, the human, want to poke a
  contract while debugging what the agent saw.

## One caveat

An indexed explorer API is a dependency you don't control: rate limits and
indexing lag are real, and "balance as of the latest indexed block" is not
always "balance right now." For anything the user might act on financially,
have the agent state the block/timestamp its answer is based on, and consider
confirming balances against a direct RPC read.
