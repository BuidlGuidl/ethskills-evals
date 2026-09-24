# wallet-activity — a pay-per-call API for agents

A single endpoint that returns a short summary of a wallet's recent on-chain
activity, gated behind an inline USDC payment on Base. No accounts, no API keys,
no invoicing: the caller pays in the HTTP request itself.

This is built on **[x402](https://x402.org)** — Coinbase's revival of the dormant
`HTTP 402 Payment Required` status code. The handshake is:

```
GET /v1/wallet/0xabc…                    -> 402 + a machine-readable price quote
GET /v1/wallet/0xabc… (X-PAYMENT: …)     -> 200 + the summary
                                            + X-PAYMENT-RESPONSE: settlement tx
```

x402 was chosen because it is the one option that matches "payment inline in the
request" literally. Alternatives were worse fits: Stripe/L402 need accounts or
macaroons, and a plain "send me ETH then call me" scheme makes the agent manage
nonces, gas, and confirmation latency itself.

## What the caller actually signs

Not a transaction — an **EIP-3009 `transferWithAuthorization`** signature over the
USDC contract. The agent needs zero ETH for gas and never broadcasts anything.
A *facilitator* verifies that signature, submits it, and pays the gas.

## Where the payment settles

**Straight to the address in `PAY_TO_ADDRESS`, as an ERC-20 transfer of USDC on
Base.** The facilitator relays the signed authorization; it never takes custody
and cannot redirect the funds. You do not need to withdraw anything.

| | base-sepolia (default) | base (mainnet) |
|---|---|---|
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Facilitator | `x402.org/facilitator` (public, free) | Coinbase CDP (needs API keys) |
| Money | test USDC from a faucet | real |

Verified working: a live testnet call settled as
[`0xf4188bc6…35d1ca`](https://sepolia.basescan.org/tx/0xf4188bc66296c218729e5b06d4203933c584ed86f0583088b6084e1fab35d1ca)
— one `Transfer` of 10,000 units ($0.01) from the payer directly to `PAY_TO_ADDRESS`.

## Run it

```bash
npm install
cp .env.example .env     # set PAY_TO_ADDRESS at minimum
npm run server
```

Check the price without paying:

```bash
curl localhost:4021/            # free discovery: price, asset, payTo
curl -i localhost:4021/v1/wallet/0x4200000000000000000000000000000000000006
# -> 402, with an `accepts` block quoting maxAmountRequired, asset, and payTo
```

Then pay for it with the included client. It needs a key funded with USDC on the
same network — on testnet, grab some from the
[Circle faucet](https://faucet.circle.com) (select Base Sepolia):

```bash
npm run client -- 0x4200000000000000000000000000000000000006
```

It prints the summary and the settlement tx hash. The 402, the signature, and the
retry are all handled inside `wrapFetchWithPayment` — from the agent's side it is
one `await`.

## Layout

| File | What it does |
|---|---|
| `src/server.ts` | Hono app; `paymentMiddleware` gates `GET /v1/wallet/*` |
| `src/activity.ts` | The product: builds the wallet summary |
| `src/client.ts` | Paying client — importable (`createPaidClient`) and runnable |
| `src/config.ts` | Env/network/asset config, one place to change |

## Two things worth knowing

**Errors are free.** The middleware settles payment only after the handler
returns a 2xx. A bad address (400) or an upstream failure (502) costs the caller
nothing, so you are not charging for failures.

**The summary has two tiers.** Without config it uses public Base RPC only:
balance, nonce, EOA-vs-contract. Set `ETHERSCAN_API_KEY` (free, one key covers
Base via Etherscan V2) and it adds the part that makes the endpoint worth paying
for — recent transaction counts, in/out split, failures, gas spent,
counterparties, tokens moved, last-active time. **Get that key before you launch.**

## Going to mainnet

1. Get CDP API keys at [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com),
   set `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET`.
2. Set `NETWORK=base` and point `PAY_TO_ADDRESS` at an address you control the
   keys to — it now receives real money. The server refuses to start on mainnet
   without the CDP keys rather than silently falling back to the test facilitator.
3. Deploy behind TLS. The `resource` field in the quote is derived from the
   request URL, so the public hostname must be the one clients call.

## Where to take it next

The gap between this and a production service is mostly operational, not protocol:

- **Caching.** Every paid call currently hits RPC and the explorer live. Caching
  summaries for ~60s cuts cost per call without changing what the caller sees.
- **Rate limits.** Payment stops free abuse but not paid abuse; a caller can
  still push load as fast as it can pay.
- **Pricing.** `$0.01` flat is a guess. The interesting variable is whether agents
  will pay more for a deeper lookback window.
- **Discovery.** x402 has a bazaar/index where paid endpoints can list themselves,
  which is how agents find an API they were not told about.
