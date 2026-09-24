Use GoldRush by Covalent, preferably through the GoldRush MCP server for an
agent-facing integration.

Wire the agent to `@covalenthq/goldrush-mcp-server` with a `GOLDRUSH_API_KEY`.
Then the agent addresses wallet questions by calling MCP tools with the wallet
address and chain names instead of scraping explorers or decoding RPC:

- `multichain_balances` for balances across multiple EVM chains
- `multichain_transactions` or `transactions_for_address` for recent wallet
  transactions with decoded logs
- `erc20_token_transfers` for token transfer history

If using direct HTTPS instead of MCP, call the same GoldRush API routes, for
example:

- `GET https://api.covalenthq.com/v1/address/{wallet}/balances_multi/`
- `GET https://api.covalenthq.com/v1/{chain}/address/{wallet}/balances_v2/`
- `GET https://api.covalenthq.com/v1/{chain}/address/{wallet}/transactions_v3/`
- `GET https://api.covalenthq.com/v1/{chain}/address/{wallet}/transfers_v2/`

So a user question like "what has 0xabc... been doing on Ethereum and Base?"
becomes structured tool calls such as `multichain_transactions` and
`multichain_balances` with `walletAddress: "0xabc..."` and chains like
`["eth-mainnet", "base-mainnet"]`. The agent receives normalized JSON with
balances, prices, decoded transaction data, and transfers ready to summarize.
