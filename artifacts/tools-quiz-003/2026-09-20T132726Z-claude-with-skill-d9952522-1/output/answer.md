# Giving a wallet-analysis agent structured on-chain data

## Recommendation: the hosted Blockscout MCP server

Wire the agent to **`https://mcp.blockscout.com/mcp`** (Streamable HTTP MCP endpoint).

This is the agent-native path. You don't scrape explorer HTML, and you don't decode raw
RPC logs — Blockscout's indexer has already done both, and MCP hands the result to the
model as tool calls with typed JSON results.

Verified live on 2026-09-20: the endpoint initializes (`blockscout-mcp-server` 1.26.0,
server app 0.19.0) and advertises the tools listed below.

## How the agent addresses it

Register it as a remote MCP server — no API key, no local process:

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

In Claude Code the equivalent one-liner is:

```bash
claude mcp add --transport http blockscout https://mcp.blockscout.com/mcp
```

Any MCP-capable client works the same way (Claude Agent SDK, Cursor, or a custom loop
using an MCP client library). The transport is Streamable HTTP, so the server returns an
`mcp-session-id` on `initialize` that your client must echo on subsequent calls —
every real MCP client handles this for you.

The server also exposes `__unlock_blockchain_analysis__`, which returns reference data
and points at a `blockscout-analysis` skill with query strategies. Have the agent call it
once at session start; it materially improves how the model sequences the other tools.

## The tools your use case actually needs

These map almost one-to-one onto "recent transactions, token transfers, and balances":

| Question the user asks | Tool |
| --- | --- |
| "What has this wallet been doing?" | `get_transactions_by_address` — native transfers, contract calls, internal txs |
| "What tokens moved in/out?" | `get_token_transfers_by_address` — ERC-20 transfers, time-range filtered |
| "What does it hold?" | `get_tokens_by_address` (ERC-20 holdings + metadata + market data), `nft_tokens_by_address`, `get_address_info` (native balance + address facts) |
| "Tell me about this one tx" | `get_transaction_info` |
| "vitalik.eth" | `get_address_by_ens_name` |

Multi-chain is built in: **`get_chains_list`** returns the supported chains and their
chain IDs, and the address/transaction tools take a `chain_id`. That is how you cover
"a couple of chains" without standing up a separate integration per network — one
endpoint, one credential-free connection, chain selected per call.

For anything the curated tools don't cover, `direct_api_call` reaches raw Blockscout REST
endpoints, and `get_contract_abi` / `inspect_contract_code` / `read_contract` are there if
the agent needs to decode or query a specific contract.

## When to use the REST API instead

Reach for the documented Blockscout REST API (or another explorer REST API) when
**application code**, not the model, is the consumer — background jobs, caching layers,
a dashboard that refreshes on a timer — or if you need to run fully self-hosted and MCP
isn't available. Same indexed data, just addressed as HTTP rather than as tool calls.

What to avoid either way: scraping explorer HTML, and hand-decoding raw `eth_getLogs`
output. Both are the failure modes you already named, and an indexed interface removes
the need for both.
