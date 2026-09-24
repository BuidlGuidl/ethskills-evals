# Giving a wallet-inspection agent structured on-chain data

**Short answer: wire the agent to the Blockscout MCP server at `https://mcp.blockscout.com/mcp`.**

No scraping, no hand-decoding RPC hex. It is a Model Context Protocol server purpose-built
to hand blockchain data to LLM agents in a structured, already-interpreted form.

## Why this over the alternatives

| Approach | Problem |
|---|---|
| Scraping a block explorer's HTML | Breaks on every UI change, rate-limited, no types, you babysit it forever |
| Raw JSON-RPC (`eth_getLogs`, `eth_getTransactionReceipt`) | Returns undecoded hex — you must fetch ABIs, decode Transfer logs, resolve token decimals/symbols yourself |
| Etherscan-family REST API | Perfectly fine, but it's an HTTP API you must wrap in tool definitions per chain, per key, per endpoint |
| **Blockscout MCP** | Agent-native protocol; tool schemas ship with the server; multi-chain; responses shaped for LLM consumption |

## What it covers — which is exactly your question set

- Address queries: recent transactions for a wallet
- Token transfers (ERC-20/721) already decoded, with symbol/decimals attached
- Token info and balances
- Contract/transaction lookups and smart-contract interaction helpers
- Multi-chain support, so "a couple of chains" is a parameter, not a second integration

## How the agent addresses it

It's a remote MCP server over HTTP — the agent connects to the URL and the tool list
arrives via the protocol. Nothing to install or self-host.

**Claude Code / Claude Desktop (`.mcp.json` or `claude_json` config):**

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

Or from the CLI:

```bash
claude mcp add --transport http blockscout https://mcp.blockscout.com/mcp
```

**Anthropic API (MCP connector)** — if your agent is a service rather than Claude Code,
pass the server in the `mcp_servers` block of the Messages request so the model can call
its tools directly:

```json
"mcp_servers": [
  { "type": "url", "url": "https://mcp.blockscout.com/mcp", "name": "blockscout" }
]
```

Either way the agent now calls named tools ("transactions for this address", "token
balances for this address") and gets back JSON it can reason over — no HTML, no hex.

## Two things worth adding

- **Fallback read path:** keep an Etherscan-compatible API key around
  (`api.etherscan.io`, Arbiscan/Basescan/Optimistic Etherscan are the same shape) as a
  second source if MCP is down or a chain isn't covered. Read-only, same data, more glue code.
- **Ad-hoc contract poking:** for the human debugging the agent, https://abi.ninja —
  paste a verified contract address, get a UI for every function, multi-chain, zero setup.
  CLI equivalent is Foundry's `cast call` / `cast interface`.

## What you do *not* need

Writes are out of scope for a read-only wallet-questions agent — don't give it keys. If
you later add them, that's Foundry `cast send` or viem, not this path.

MCP servers compose, so you can stack `eth-mcp` or an ENS wrapper alongside Blockscout
without reworking anything.
