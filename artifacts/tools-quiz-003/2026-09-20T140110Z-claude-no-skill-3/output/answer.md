# Giving the agent structured on-chain data

**Wire up the Etherscan V2 multichain API** (`https://api.etherscan.io/v2/api`) as the
agent's single data tool. It is the block explorer's own JSON API — the same index that
backs the HTML pages you were thinking of scraping — so you get decoded, ready-to-consume
records without scraping and without decoding RPC responses yourself.

## Why this one

- **Already structured.** `txlist` returns transactions with `from`, `to`, `value`,
  `gasUsed`, `timeStamp`, `isError`, `functionName`. `tokentx` returns ERC-20 transfers
  with `tokenSymbol`, `tokenDecimal`, `contractAddress` — the log decoding and token
  metadata lookup are done for you.
- **"A couple of chains" is one integration.** V2 replaced the old per-explorer hosts
  (api.etherscan.io, api.basescan.org, api.arbiscan.io …) with one host plus a
  `chainid` query parameter, and **one API key works across all supported chains**
  (60+, including Ethereum 1, Base 8453, Arbitrum 42161, Optimism 10, Polygon 137, BSC 56).
  Adding a chain is changing an integer, not onboarding a new vendor.
- **Wallet-centric by design.** Every endpoint the agent needs is keyed on an address,
  which is exactly the shape of the questions being asked.

## How the agent addresses it

All calls are `GET` with `module`, `action`, `chainid`, `apikey`:

```
# native balance
/v2/api?chainid=8453&module=account&action=balance&address=0xABC…&tag=latest

# up to 20 addresses in one call
/v2/api?chainid=1&module=account&action=balancemulti&address=0xA,0xB,0xC&tag=latest

# recent transactions, newest first
/v2/api?chainid=1&module=account&action=txlist&address=0xABC…&startblock=0&endblock=99999999&page=1&offset=25&sort=desc

# ERC-20 transfers (add &contractaddress=… to scope to one token)
/v2/api?chainid=1&module=account&action=tokentx&address=0xABC…&page=1&offset=25&sort=desc

# NFT transfers
…&action=tokennfttx…

# internal txs (contract-initiated value moves the txlist won't show)
…&action=txlistinternal…
```

Responses are `{"status":"1","message":"OK","result":[…]}`. `status:"0"` with
`message:"No transactions found"` is an empty result, not an error — handle that case
explicitly or the agent will hallucinate a failure.

### Tool design for the agent

Do **not** expose the raw URL builder as one tool. Give the model a handful of narrow
tools so the chain and paging are the model's only real choices:

| Tool | Params | Wraps |
|---|---|---|
| `get_balances(address, chains[])` | address, chain list | `balance` per chain |
| `get_recent_transactions(address, chain, limit=25)` | | `txlist`, `sort=desc` |
| `get_token_transfers(address, chain, token?, limit=25)` | | `tokentx` |

In the wrapper, before handing results back to the model:

- **Normalize units.** Convert `value` by 18 decimals for native, by `tokenDecimal` for
  tokens. Raw wei strings are a reliable source of agent arithmetic errors.
- **Convert `timeStamp`** (unix seconds, string) to ISO-8601.
- **Cap and trim.** Default `offset=25` and drop fields the answer never uses
  (`blockHash`, `nonce`, `confirmations`, `cumulativeGasUsed`). A full `txlist` page will
  otherwise swamp the context window.
- **Accept ENS at the edge,** not in the tool: resolve `vitalik.eth` → address yourself
  before the call; these endpoints take hex addresses only.

## Practical constraints

- **Rate limit:** 5 calls/sec on the free tier, with a daily cap. An agent that fans out
  across three chains burns that fast — put a small token-bucket limiter and a short TTL
  cache (30–60s per address+chain) in the wrapper. Retry on `"Max rate limit reached"`.
- **Full ERC-20 balance sheet is a Pro endpoint.** `account&action=addresstokenbalance`
  ("every token this wallet holds") requires a paid plan. On the free tier you can either
  check known tokens one at a time via `account&action=tokenbalance&contractaddress=…`,
  or derive the candidate token set from the wallet's `tokentx` history and price the
  balances individually. If a complete portfolio view is a core feature, this is the line
  item to budget for.
- **Verify the current chain list and endpoint tiers against the docs** before you commit
  to a chain set — coverage and free/Pro boundaries move.

## When to reach for something else

- **Need full token portfolios + prices out of the box** → Alchemy's enhanced APIs
  (`alchemy_getTokenBalances`, `alchemy_getAssetTransfers`) or Covalent/GoldRush's
  unified `/balances_v2/` and `/transactions_v3/`. Both are also decoded JSON; you trade
  Etherscan's explorer-grade tx labeling for stronger balance coverage.
- **Aggregated, human-readable activity across many chains** → Zerion or Zapper APIs,
  which return "swapped X for Y on Uniswap" rather than raw transfers.

For the described agent — recent transactions, token transfers, and balances on a couple
of chains — **Etherscan V2 is the smallest thing that works**: one key, one base URL, one
`chainid` parameter, decoded results.
