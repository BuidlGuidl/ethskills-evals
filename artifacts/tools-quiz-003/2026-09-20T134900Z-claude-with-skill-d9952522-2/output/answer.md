# Giving a wallet-analysis agent structured on-chain data

## Recommendation: the Blockscout MCP server

Wire the agent to the hosted **Blockscout MCP server** at:

```
https://mcp.blockscout.com/mcp
```

It is a remote MCP server (streamable HTTP transport). Instead of the agent
scraping explorer HTML or decoding raw RPC responses, it calls named tools and
gets back indexed, decoded, JSON data — human-readable token amounts with
decimals applied, resolved token metadata, decoded transaction inputs and
logs — which is exactly the shape an LLM can consume without a parsing layer.

Verified live on 2026-09-20: the endpoint answers `initialize` as
`blockscout-mcp-server` v1.26.0 and advertises the tool set below.

## How the agent addresses it

Add it as a remote MCP server. In Claude Code:

```bash
claude mcp add --transport http blockscout https://mcp.blockscout.com/mcp
```

Or in an MCP client config (`.mcp.json` / `claude_desktop_config.json`):

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

For a custom agent loop, point your MCP client library at the same URL over
streamable HTTP; no API key is needed for the public instance.

## The tools that cover your three questions

Multi-chain is handled by a `chain_id` argument on the data tools rather than a
separate deployment per chain — call `get_chains_list` once to discover the
supported chains and their IDs (Ethereum mainnet is `1`).

| Your question | Tool |
| --- | --- |
| Recent transactions | `get_transactions_by_address` — native transfers, contract calls, internal txs; time-range filterable and paginated |
| Token transfers | `get_token_transfers_by_address` — ERC-20 transfers over a time range, paginated |
| Balances | `get_address_info` (native balance + address metadata), `get_tokens_by_address` (ERC-20 holdings with metadata and market data), `nft_tokens_by_address` (ERC-721/1155/404 grouped by collection) |
| Single tx detail | `get_transaction_info` — decoded input and logs, far richer than `eth_getTransactionByHash` |
| Name → address | `get_address_by_ens_name` |
| Contract introspection | `get_contract_abi`, `inspect_contract_code`, `read_contract` |
| Blocks / time anchoring | `get_block_info`, `get_block_number` (resolve a date/time to a block) |
| Anything chain-specific | `direct_api_call` — raw Blockscout REST endpoint escape hatch |

Two session conventions worth following: call
`__unlock_blockchain_analysis__` at the start of a session (it returns server
reference data and the pointer to the `blockscout-analysis` skill with usage
strategy and the curated `direct_api_call` endpoint reference), and read that
skill before the first `direct_api_call`.

### A typical agent trace

1. `get_chains_list` → pick the chain IDs you care about.
2. `get_address_by_ens_name` if the user typed `vitalik.eth`.
3. Per chain: `get_address_info` + `get_tokens_by_address` for the balance
   picture, `get_transactions_by_address` + `get_token_transfers_by_address`
   for recent activity.
4. `get_transaction_info` to drill into whatever the user asks about.

## When to use the REST API instead

Reach for the documented Blockscout REST API (or another explorer REST API)
when **application code**, not the agent, is the consumer — a backend job
building a cache or a dashboard — or if MCP is unavailable in your runtime.
`direct_api_call` also exposes those endpoints through MCP when a tool doesn't
cover a chain-specific need.

What to avoid either way: scraping explorer HTML, and hand-decoding raw logs
off an RPC node. Both are the babysitting work you're trying to skip, and an
indexed interface already does it.
