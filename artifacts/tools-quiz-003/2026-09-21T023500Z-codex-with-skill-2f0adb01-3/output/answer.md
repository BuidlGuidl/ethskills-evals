Use the Blockscout MCP server:

`https://mcp.blockscout.com/mcp`

I would wire the agent up to that MCP endpoint instead of scraping explorers or hand-parsing raw RPC. Blockscout MCP exposes structured, ready-to-consume blockchain data through Model Context Protocol tools: address lookups, recent transactions, token transfers, token balances, contract metadata, and related chain-aware queries.

The agent addresses it as an MCP server. In practice, the agent sends tool calls with the target chain/network plus the wallet address, for example:

```text
MCP server: https://mcp.blockscout.com/mcp
Query shape: { chain: "ethereum" | "base" | "optimism" | ..., address: "0x..." }
Tasks: get address details, list recent transactions, list token transfers, fetch token balances
```

So the agent's workflow becomes: normalize the user's wallet and requested chains, call the appropriate Blockscout MCP tools for each chain, then summarize the structured results. That keeps the agent out of brittle HTML scraping and avoids making it decode low-level RPC responses itself.
