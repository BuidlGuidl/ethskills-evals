# Giving a wallet-Q&A agent clean on-chain data

## Short answer

Wire the agent to the **Etherscan V2 multichain API** (`https://api.etherscan.io/v2/api`)
and expose a handful of its `module=account` actions as agent tools. One API key,
one base URL, one JSON shape — the chain is just a `chainid` query parameter.

That covers exactly the three things you listed (recent transactions, token
transfers, balances) as decoded, ready-to-consume JSON. No HTML scraping, no
ABI decoding, no log-topic parsing.

## Why this over the alternatives

- **Scraping etherscan.io** — brittle, rate-limited/blocked, and you'd be
  re-deriving data that the same company already serves as JSON.
- **Raw JSON-RPC (Alchemy/Infura/your own node)** — `eth_getLogs` +
  `eth_getTransactionByHash` gives you hex blobs. To answer "what tokens did
  this wallet receive last week" you'd have to decode Transfer topics, resolve
  token metadata, fetch decimals, and paginate by block range yourself. RPC has
  no "list this address's transactions" method at all — that's an indexer
  feature, not a node feature.
- **Etherscan V2** — the indexing, decoding, token metadata, and
  address-based history are already done. You get `tokenSymbol`,
  `tokenDecimal`, `timeStamp`, `functionName` as fields.

## The endpoints to wire up

Base: `https://api.etherscan.io/v2/api`
Every call takes `chainid=<id>` and `apikey=<key>`.

| Agent capability | Call |
|---|---|
| Recent transactions | `module=account&action=txlist&address=0x…&startblock=0&endblock=99999999&page=1&offset=100&sort=desc` |
| Internal txs (contract-initiated value moves) | `module=account&action=txlistinternal&address=0x…` |
| ERC-20 transfers | `module=account&action=tokentx&address=0x…` (add `&contractaddress=` to filter to one token) |
| NFT transfers | `module=account&action=tokennfttx&address=0x…` (ERC-721) / `action=token1155tx` (ERC-1155) |
| Native balance | `module=account&action=balance&address=0x…&tag=latest` |
| Native balance, up to 20 addresses at once | `module=account&action=balancemulti&address=0xA,0xB,…` |
| One ERC-20 balance | `module=account&action=tokenbalance&contractaddress=0x…&address=0x…&tag=latest` |
| Single tx status / receipt status | `module=transaction&action=gettxreceiptstatus&txhash=0x…` |

Response envelope is uniform: `{"status":"1","message":"OK","result":[…]}`.
`status:"0"` with `message:"No transactions found"` is a normal empty result,
not an error — handle that case explicitly or your agent will report failures
for fresh wallets.

## "A couple of chains" — how the agent addresses them

This is the part V2 fixed. In V1 each chain was a separate host
(`api.etherscan.io`, `api.basescan.org`, `api.arbiscan.io`, …) with a separate
key. In V2 it's the same host and the same key for 60+ chains; you just switch
`chainid`:

```
1      Ethereum mainnet
8453   Base
42161  Arbitrum One
10     Optimism
137    Polygon
56     BNB Smart Chain
11155111  Sepolia
```

So a multichain balance sweep is the same request in a loop:

```bash
for cid in 1 8453 42161 10; do
  curl -s "https://api.etherscan.io/v2/api?chainid=$cid&module=account&action=balance&address=$ADDR&tag=latest&apikey=$ETHERSCAN_API_KEY"
done
```

Give the agent a `chain` parameter on each tool, backed by a name→chainid map,
and let it fan out across chains in parallel.

## Shape of the agent-side tools

Don't hand the model a generic `http_get`. Define narrow tools so the model
picks by intent rather than by URL construction:

- `get_wallet_balance(address, chain)` → native balance, already converted from
  wei to a decimal string.
- `get_wallet_transactions(address, chain, limit=25)` → trimmed list; drop
  `input` (calldata blobs eat context), keep hash, timestamp, from, to, value,
  `functionName`, `isError`.
- `get_token_transfers(address, chain, token=None, limit=25)` → apply
  `tokenDecimal` to `value` before returning, so the model sees `12.5 USDC`
  not `12500000`.
- `get_token_balances(address, chain)` → loop `tokenbalance` over the token
  contracts you saw in `tokentx`, or use the Pro `addresstokenbalance` action
  if you're on a paid plan.

Two rules that matter more than the endpoint choice:

1. **Normalize before the model sees it.** Convert wei and token decimals,
   convert `timeStamp` (unix seconds, as a string) to ISO dates, strip calldata.
   An agent reasoning over raw `result` objects will make unit errors.
2. **Cap `offset` and paginate deliberately.** `offset=10000` will blow your
   context window. Default to 25–100 and let the agent ask for more.

## Practical notes

- Free tier: 5 calls/sec, 100k calls/day. Add a small token-bucket limiter in
  the tool layer — the agent will happily fire parallel calls and trip it.
- `txlist` returns at most 10,000 records per address query; for high-volume
  wallets page by `startblock`/`endblock` rather than by `page`.
- Keep the key server-side. The agent's tool implementation injects it; the
  key never appears in a model-visible argument.
- If you later want full DeFi position data (LP shares, staked balances, USD
  pricing), that's beyond a block explorer's scope — a portfolio API like
  Zerion or Zapper is the right add-on. For transactions, transfers, and
  balances, Etherscan V2 alone is sufficient.

## Packaging

If your agent framework speaks MCP, put these tools behind a small MCP server
so the same wallet toolset is reusable across clients. Otherwise plain function
tools in your agent loop are fine — the value is in the normalization layer, not
the transport.
