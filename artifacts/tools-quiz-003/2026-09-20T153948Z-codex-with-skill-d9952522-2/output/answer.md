Use the Blockscout MCP server: `https://mcp.blockscout.com/mcp`.

That is the cleanest fit because the consumer is the AI agent itself. Instead of scraping explorer pages or teaching the model to decode raw JSON-RPC/log output, register Blockscout as an MCP server and let the agent call typed tools that already return indexed, decoded wallet data.

I would wire the agent to address it as an MCP tool server named something like `blockscout`, using the hosted Streamable HTTP endpoint:

```toml
[mcp_servers.blockscout]
url = "https://mcp.blockscout.com/mcp"
http_headers = { "Blockscout-MCP-Pro-Api-Key" = "<YOUR_BLOCKSCOUT_PRO_API_KEY>" }
```

For a wallet question, the agent should pass the target chain and wallet into Blockscout's MCP tools:

- Resolve supported networks with `get_chains_list`.
- Resolve ENS input with `get_address_by_ens_name` when needed.
- Fetch wallet overview with `get_address_info`.
- Fetch native transactions with `get_transactions_by_address`.
- Fetch ERC-20 transfer history with `get_token_transfers_by_address`.
- Fetch token balances/holdings with `get_tokens_by_address`.
- Fetch NFT holdings with `nft_tokens_by_address` if the question includes NFTs.

The addressing model is simple: use `chain_id` for the chain, such as `1` for Ethereum mainnet or `8453` for Base, and `address` for the wallet, such as `0x...`. For recent activity, include an `age_from` ISO timestamp and paginate with the returned cursor when there are more results.

If the agent runtime cannot use MCP, use Blockscout's REST mirror of the same surface instead, for example:

```text
GET https://mcp.blockscout.com/v1/get_transactions_by_address?chain_id=1&address=0x...&age_from=2026-09-01T00:00:00Z
GET https://mcp.blockscout.com/v1/get_token_transfers_by_address?chain_id=1&address=0x...&age_from=2026-09-01T00:00:00Z
GET https://mcp.blockscout.com/v1/get_tokens_by_address?chain_id=1&address=0x...
```

But for an AI agent, the primary recommendation is Blockscout MCP at `https://mcp.blockscout.com/mcp`, because the agent can directly discover and invoke the wallet-data tools as structured calls.
