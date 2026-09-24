# Wallet Activity API — paid per call over x402

A paid HTTP endpoint for AI agents. The agent calls `GET /activity/:address`,
pays a few cents of USDC inline in the request, and gets back a short summary of
that wallet's recent on-chain activity. No accounts, no API keys, no invoicing.

Payment uses **[x402](https://x402.org)**, the HTTP 402 payment protocol:

1. Agent calls the endpoint with no payment → server replies `402 Payment
   Required` with a `PAYMENT-REQUIRED` header describing amount, asset, network,
   and recipient.
2. The client signs an off-chain USDC transfer authorization (EIP-3009) for
   exactly that amount and replays the request with an `X-PAYMENT` header.
3. The server hands that authorization to a **facilitator**, which verifies it
   and broadcasts the USDC transfer on Base. The server then runs the handler and
   returns the summary, with the settlement tx hash in `X-PAYMENT-RESPONSE`.

The agent never holds an account with you and never pays gas — the facilitator
submits the transaction.

## Where the payment settles

**USDC on Base, directly to the `PAY_TO` address you configure.** There is no
intermediate balance or custodian: each call is its own on-chain USDC transfer
from the agent's wallet to yours. `X-PAYMENT-RESPONSE` on a successful response
carries the settlement transaction hash.

| `CHAIN` | Network | USDC | Facilitator |
|---|---|---|---|
| `base-sepolia` (default) | `eip155:84532` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | `https://x402.org/facilitator` — free, no keys |
| `base` | `eip155:8453` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Coinbase CDP — **requires API keys** |

The public x402.org facilitator only settles testnets. Real money on Base
mainnet means `CHAIN=base` plus CDP API keys from
[portal.cdp.coinbase.com](https://portal.cdp.coinbase.com) in
`CDP_API_KEY_ID` / `CDP_API_KEY_SECRET`.

## Run it

```bash
npm install
cp .env.example .env    # set PAY_TO at minimum
```

Server:

```bash
PAY_TO=0xYourAddress npm run server
# Wallet Activity API on http://localhost:4021
```

The unpaid discovery endpoint tells an agent what it costs:

```bash
curl localhost:4021/
curl -i localhost:4021/activity/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045   # 402 + PAYMENT-REQUIRED
```

Client (pays and retries automatically):

```bash
PRIVATE_KEY=0x... npm run client -- 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
```

The client wallet needs **USDC on the target chain and nothing else** — no ETH
for gas. For Base Sepolia, get test USDC from the
[Circle faucet](https://faucet.circle.com).

## Layout

| Path | What |
|---|---|
| `server/index.ts` | Express app; `paymentMiddleware` gates `GET /activity/:address` |
| `server/config.ts` | Chain/asset/facilitator selection, price, `PAY_TO` |
| `server/activity.ts` | The actual product: wallet summary via the Blockscout v2 API |
| `client/index.ts` | Agent-side client using `wrapFetchWithPayment` |

Stack: `@x402/express` + `@x402/evm` server side, `@x402/fetch` + `viem` client
side, Blockscout for the chain data (no API key needed).

## Things to decide next

- **Pricing.** `PRICE` is a dollar string (`"$0.02"`); the exact scheme converts
  it to USDC atomic units at request time. Per-route pricing goes in the routes
  object in `server/index.ts`.
- **Mainnet cutover.** Set `CHAIN=base`, add CDP keys, and point `PAY_TO` at an
  address you actually control. Test the whole flow on `base-sepolia` first —
  settlement is irreversible.
- **Spend caps.** The client sets `maxAmountPerPayment` (default `$0.10`) so a
  server that raises its price can't drain the agent wallet. The SDK enforces a
  `$1` cap by default even if you don't.
- **Handler failures after settlement.** Payment settles *before* the handler
  runs, so a Blockscout outage means the caller paid and got a 502. If that
  matters, look at `setSettlementOverrides` from `@x402/express` for partial
  settlement, or verify upstream health before the paid route.
- **Scam-token noise.** Blockscout returns spoofed tokens in transfer history
  (lookalike `ETH` symbols and similar). It exposes `is_scam` / reputation
  fields — filter on those in `server/activity.ts` before this goes in front of
  agents making decisions.
- **Discovery.** x402 has a "bazaar" extension for listing paid endpoints so
  agents can find them; `RouteConfig.extensions` is where that hooks in.

## Verified

End-to-end against Base Sepolia: unpaid call returns a well-formed 402
(`amount: "20000"` = $0.02 USDC, correct asset and `payTo`); the client signs and
retries; the facilitator verifies against the real chain. With an unfunded
wallet it correctly rejects with `invalid_exact_evm_insufficient_balance` — the
one step not exercised is settlement with a funded wallet.
The summary path is verified against live Base mainnet data.
