Use Blockscout's hosted MCP server:

`https://mcp.blockscout.com/mcp`

Wire the agent to it as an MCP server, ideally with a Blockscout PRO API key in
the `Blockscout-MCP-Pro-Api-Key` header. The agent then addresses on-chain data
as structured MCP tool calls instead of scraping explorer pages or decoding raw
RPC payloads.

For a wallet question, the agent should:

1. Call `__unlock_blockchain_analysis__` once at session start.
2. Use `get_chains_list` to resolve supported chain IDs.
3. For each target chain, call tools such as:
   - `get_address_info(chain_id, address)` for wallet/native balance and address metadata.
   - `get_tokens_by_address(chain_id, address)` for ERC-20 holdings.
   - `get_transactions_by_address(chain_id, address, age_from, age_to)` for recent transactions.
   - `get_token_transfers_by_address(chain_id, address, age_from, age_to, token)` for ERC-20 transfer history.

That gives the agent indexed, normalized, ready-to-consume JSON across chains
through a single agent-native interface.
