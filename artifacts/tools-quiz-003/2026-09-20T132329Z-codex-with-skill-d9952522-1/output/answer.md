Use the hosted Blockscout MCP server:

`https://mcp.blockscout.com/mcp`

That is the cleanest fit because the agent can address it as an MCP tool server rather than scraping explorer pages or decoding JSON-RPC responses itself. Wire it into the agent's MCP client as a server named something like `blockscout`, with a Blockscout PRO API key passed in the request header:

`Blockscout-MCP-Pro-Api-Key: <YOUR_BLOCKSCOUT_PRO_API_KEY>`

Then let the agent call Blockscout's structured tools directly. For example:

- `get_chains_list` to resolve supported chain IDs for Ethereum, Base, Optimism, Arbitrum, etc.
- `get_address_info` for a wallet summary.
- `get_tokens_by_address` for token balances.
- `get_transactions_by_address` for recent native transfers and contract interactions.
- `get_token_transfers_by_address` for ERC-20 transfer history.
- `get_transaction_info` when the agent needs decoded details for a specific transaction.

The agent's addressing model is: choose the chain by `chain_id`, pass the wallet `address`, and add time windows or cursors where the tool supports them. A typical call is conceptually:

```json
{
  "server": "blockscout",
  "tool": "get_token_transfers_by_address",
  "arguments": {
    "chain_id": "1",
    "address": "0x...",
    "age_from": "2026-09-01T00:00:00Z"
  }
}
```

If MCP is unavailable in part of your stack, use the same Blockscout MCP server's REST mirror, for example:

`GET /v1/get_transactions_by_address?chain_id=1&address=0x...&age_from=2026-09-01T00:00:00Z`

But for an AI agent, MCP at `https://mcp.blockscout.com/mcp` is the primary interface I would wire up.
