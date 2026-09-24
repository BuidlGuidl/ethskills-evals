Use the Zerion Wallet API as the agent's on-chain data provider.

Wire the agent to:

- `GET https://api.zerion.io/v1/wallets/{address}/transactions/` for decoded, human-readable wallet activity, including operation type, transfers, fees, timestamps, and transaction hashes.
- `GET https://api.zerion.io/v1/wallets/{address}/portfolio` for the wallet's balance/portfolio summary, broken down by chain and position type.
- Optionally `GET https://api.zerion.io/v1/wallets/{address}/positions/` when the agent needs the individual token balances rather than only the aggregate portfolio.

The agent addresses Zerion by wallet address in the path, then scopes the request with query parameters such as `filter[chain_ids]=ethereum,base` and `page[size]=25`. For example:

```text
GET /v1/wallets/0xabc.../transactions/?filter[chain_ids]=ethereum,base&page[size]=25
Authorization: Basic <ZERION_API_KEY>
```

That gives the agent structured JSON that is already indexed, decoded, priced, paginated, and chain-labeled, so its tool layer can expose simple actions like `get_wallet_activity(address, chains)` and `get_wallet_balances(address, chains)` instead of scraping block explorers or interpreting raw RPC logs.
