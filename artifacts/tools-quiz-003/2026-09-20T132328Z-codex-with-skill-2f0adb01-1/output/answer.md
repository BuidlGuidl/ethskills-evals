Use the Blockscout MCP Server.

Wire the agent to the MCP endpoint:

```json
{
  "mcpServers": {
    "blockscout": {
      "url": "https://mcp.blockscout.com/mcp",
      "timeout": 180000,
      "headers": {
        "Blockscout-MCP-Pro-Api-Key": "<YOUR_BLOCKSCOUT_PRO_API_KEY>"
      }
    }
  }
}
```

Then have the agent address it as an MCP tool server named `blockscout`, not as
an HTML page or raw JSON-RPC node. For a wallet question, the agent should:

1. Resolve the target chains with `get_chains_list` if it does not already know
   the chain IDs.
2. For each selected chain, call the relevant structured tools with
   `{ "chain_id": <chain_id>, "address": "<wallet>" }`.
3. Use:
   - `get_address_info` for native balance and address metadata.
   - `get_tokens_by_address` for ERC-20 holdings.
   - `get_transactions_by_address` for recent wallet transactions.
   - `get_token_transfers_by_address` for ERC-20 transfer history.
   - `nft_tokens_by_address` if NFT holdings matter.
   - `get_transaction_info` when it needs one transaction expanded with decoded
     input, token transfers, fee details, and address enrichment.

This gives the agent ready-to-consume, paginated, multi-chain blockchain data
through a stable MCP interface. The agent asks for wallet data by chain ID and
address, and Blockscout handles the explorer/indexer work behind the scenes.

Source: https://mcp.blockscout.com/
