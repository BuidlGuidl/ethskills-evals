Use the Blockscout MCP server: `https://mcp.blockscout.com/mcp`.

That is the cleanest fit for an AI wallet agent because it exposes block-explorer-grade data through the Model Context Protocol instead of forcing the agent to scrape explorer HTML or manually decode raw RPC responses. I would wire the agent to Blockscout MCP as a tool server and have it address data by chain plus wallet address, for example:

- chain/network: Ethereum, Base, Optimism, Arbitrum, etc.
- wallet address: `0x...`
- task: recent transactions, token transfers, token balances, native balance, contract/address details

In practice, the agent connects to the MCP endpoint at `https://mcp.blockscout.com/mcp`, discovers the available Blockscout tools, then calls the relevant address, transaction, token-transfer, or balance tool with the target chain identifier and wallet address. The agent receives structured, ready-to-consume results suitable for summarization, filtering, and cross-chain wallet reports.
