Use GoldRush by Covalent, preferably through the GoldRush MCP server for an agent-facing integration.

The agent gets structured wallet data by calling MCP tools such as `multichain_balances`, `multichain_transactions`, `transactions_for_address`, and `erc20_token_transfers` with the wallet address and target chains. Under the hood, those map to the same GoldRush Foundational API endpoints you could call directly:

- Balances: `GET https://api.covalenthq.com/v1/{chain}/address/{wallet}/balances_v2/`
- Recent/full transactions with decoded logs: `GET https://api.covalenthq.com/v1/{chain}/address/{wallet}/transactions_v3/`
- ERC-20/token transfers: `GET https://api.covalenthq.com/v1/{chain}/address/{wallet}/transfers_v2/`
- Cross-chain wallet activity: `GET https://api.covalenthq.com/v1/address/{wallet}/activity/`
- Multi-chain balances: `GET https://api.covalenthq.com/v1/address/{wallet}/balances_multi/`

So the agent addresses the data by passing a normal wallet address, for example `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`, plus chain names like `eth-mainnet`, `base-mainnet`, or `matic-mainnet`. The response is already indexed, decoded, paginated, and normalized JSON with balances, token metadata, transfers, transactions, and decoded log events, which is much cleaner than scraping explorer HTML or manually interpreting raw RPC payloads.
