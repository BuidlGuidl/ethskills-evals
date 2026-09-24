# Giving the agent structured on-chain data

## Recommendation: the Etherscan V2 multichain API

Wire the agent to **Etherscan's V2 API** (`https://api.etherscan.io/v2/api`). It is the
same data that backs the explorer UI you were tempted to scrape, served as JSON, already
decoded: transactions with method names, token transfers with token symbol/decimals,
balances in base units. No HTML parsing, no ABI decoding, no log-topic unpacking.

The reason to pick V2 over the old per-explorer V1 endpoints is the "couple of chains"
part of your requirement: **one API key and one hostname works across 60+ EVM chains**
(Ethereum, Base, Arbitrum, Optimism, Polygon, BNB, …). You select the chain with a
`chainid` query parameter instead of swapping base URLs (`api.basescan.org`,
`api.arbiscan.io`, …) and juggling a separate key per explorer.

Get a free key at https://etherscan.io/myapikey (free tier: 5 calls/sec, 100k calls/day).

## The endpoints you actually need

All are `GET https://api.etherscan.io/v2/api` with `chainid`, `module`, `action`,
`address`, and `apikey`.

| Question the agent gets | `module` / `action` |
| --- | --- |
| "Recent transactions?" | `account` / `txlist` |
| "Internal transfers (contract-sent ETH)?" | `account` / `txlistinternal` |
| "ERC-20 transfers?" | `account` / `tokentx` |
| "NFT transfers?" | `account` / `tokennfttx` (ERC-721), `token1155tx` (ERC-1155) |
| "Native balance?" | `account` / `balance` (or `balancemulti`, up to 20 addresses) |
| "Balance of one ERC-20?" | `account` / `tokenbalance` with `contractaddress` |
| "Full token portfolio?" | `account` / `addresstokenbalance` (Pro tier) |

Example — last 10 transactions for a wallet on Base (`chainid=8453`):

```
https://api.etherscan.io/v2/api
  ?chainid=8453
  &module=account
  &action=txlist
  &address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
  &startblock=0&endblock=99999999
  &page=1&offset=10&sort=desc
  &apikey=YOUR_KEY
```

Responses are `{"status":"1","message":"OK","result":[...]}`. Note `status:"0"` is both
"no results" and "error" — branch on `message` (`"No transactions found"` vs. `"NOTOK"`).

## How the agent addresses it

Don't give the model a generic "HTTP GET" tool and the docs. Expose **one narrow tool per
question shape**, with the chain as an enum, and do the unit math in your code so the
model never sees wei:

```ts
{
  name: "get_wallet_activity",
  description: "Recent transactions or token transfers for a wallet on a supported chain.",
  input_schema: {
    type: "object",
    properties: {
      address: { type: "string", description: "0x-prefixed wallet address" },
      chain:   { type: "string", enum: ["ethereum", "base", "arbitrum", "optimism", "polygon"] },
      kind:    { type: "string", enum: ["transactions", "token_transfers", "nft_transfers"] },
      limit:   { type: "integer", default: 10, maximum: 100 }
    },
    required: ["address", "chain", "kind"]
  }
}
```

Your handler maps `chain` → `chainid`, `kind` → `action`, injects the key server-side,
and returns a trimmed, human-readable payload:

- resolve wei → ETH and raw token amounts → `value / 10**tokenDecimal` (the `tokentx`
  response carries `tokenSymbol` and `tokenDecimal`, so no extra lookup)
- convert `timeStamp` to ISO-8601
- drop the fields a model won't use (`nonce`, `blockHash`, `confirmations`, `gasUsed`
  unless asked) — this is the difference between a 40k-token tool result and a 2k one
- keep `hash` and emit an explorer URL so the agent can cite its source

Practical guardrails: cache per `(address, chain, kind)` for ~15s, throttle to stay under
5 rps, and treat `Max rate limit reached` as retryable with backoff. For "across a couple
of chains" questions, fan out the per-chain calls in parallel and merge by timestamp
rather than asking the model to make five sequential tool calls.

## Alternatives, briefly

- **Alchemy Data / Portfolio APIs** (`alchemy_getAssetTransfers`, `getTokenBalances`,
  `/v2/:key/assets/tokens/by-address`) — best if you're already on Alchemy for RPC and
  want token balances with USD pricing in one response. Cursor-based pagination is nicer
  than Etherscan's page/offset for deep history.
- **Covalent / GoldRush unified API** — one call returns an address's full multi-chain
  token portfolio with spot prices; strongest option if "balances" is the dominant
  question and you want pricing bundled.
- **The Graph / Dune** — only worth it for protocol-specific or aggregate analytics, not
  for generic per-wallet activity. Both are far more setup than this problem needs.

Start with Etherscan V2; add Alchemy or Covalent later only if you need USD valuations,
which Etherscan's free tier doesn't provide.
