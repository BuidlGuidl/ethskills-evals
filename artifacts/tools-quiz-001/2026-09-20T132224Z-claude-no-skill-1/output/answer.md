# Paid API for AI agents: x402 on Base

## The short answer

The standard way to do this today is **x402** — an open payment protocol that revives
HTTP `402 Payment Required`. Your server answers an unpaid request with `402` plus a
JSON body describing what it wants (amount, asset, chain, your receiving address). The
client signs an off-chain authorization for that exact amount, retries the same request
with an `X-PAYMENT` header, and your middleware has a *facilitator* verify and settle it
on-chain before your handler runs. Settlement detail comes back on `X-PAYMENT-RESPONSE`.

Why it fits your constraints:

- **No accounts, no API keys, no invoicing.** The payment *is* the authentication.
- **Inline in the request.** One extra round trip (402 → retry), not an out-of-band flow.
- **Cents work.** Payment is USDC on Base — a $0.02 call is a normal amount, not dust.
- **Your client pays no gas.** The signature is an EIP-3009 / Permit2 authorization; the
  facilitator broadcasts and pays gas. Your agent needs USDC, not ETH.

The maintained packages are the scoped **`@x402/*`** namespace, currently **v2.26.0**
(published 2026-09-15). There's an older unscoped `x402` / `x402-express` / `x402-fetch`
line stuck at **1.2.0** (last touched April 2026) — see "Don't install these" below.

## What to install

Server (Express, Base mainnet):

```bash
npm i @x402/express @x402/evm @x402/core @coinbase/x402 express
```

Client (the agent):

```bash
npm i @x402/fetch @x402/evm viem
# or, if the agent uses axios:
npm i @x402/axios @x402/evm viem axios
```

All verified resolving and installing today (2026-09-20), and both code samples below
were compiled against the real type definitions with `tsc --strict`:

| Package | Version |
| --- | --- |
| `@x402/core` | 2.26.0 |
| `@x402/express` | 2.26.0 |
| `@x402/fetch` | 2.26.0 |
| `@x402/axios` | 2.26.0 |
| `@x402/evm` | 2.26.0 |
| `@coinbase/x402` | 2.1.0 |
| `viem` | 2.56.8 |

`@x402/express` declares an optional peer on `@x402/paywall` (the browser-facing paywall
UI). Agent-only APIs don't need it; npm will not complain.

### Don't install these

- **`x402-axios@1.2.1` is broken on npm right now.** It depends on `x402@^1.2.1`, and the
  newest published `x402` is `1.2.0` — a plain `npm i x402-axios` fails with `ETARGET`.
- The whole unscoped line (`x402`, `x402-express`, `x402-fetch`, `x402-hono`, `x402-next`
  at 1.2.0) is the previous major. Use the scoped `@x402/*` packages for new work.

## Client code

The agent side is genuinely three lines of setup. `wrapFetchWithPayment` returns a
drop-in `fetch` that transparently handles the 402 and retries.

```ts
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const client = new x402Client()
  .register("eip155:8453", new ExactEvmScheme(account)); // eip155:8453 = Base mainnet

const fetchWithPay = wrapFetchWithPayment(fetch, client);

// Ordinary fetch call. The 402, the signature, and the retry all happen inside.
const res = await fetchWithPay("https://api.example.com/quote");
console.log(await res.json());

// Optional: what actually settled, including the tx hash.
const header = res.headers.get("x-payment-response");
if (header) console.log(decodePaymentResponseHeader(header));
```

**Cap what the agent can spend.** You do not want an autonomous agent signing whatever a
server asks for. The config-based form takes `spendControls`, which rejects any 402
demanding more than your cap (default is `$1` per payment):

```ts
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

export const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
  spendControls: { maxAmountPerPayment: "$0.10" },
});
```

Axios is the same shape, via `wrapAxiosWithPayment(axios.create(), client)` from
`@x402/axios`.

## Server code

```ts
import express from "express";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { facilitator } from "@coinbase/x402";

const app = express();
const NETWORK = "eip155:8453" as const;

app.use(
  paymentMiddlewareFromConfig(
    {
      "GET /quote": {
        accepts: {
          scheme: "exact",
          network: NETWORK,
          price: "$0.02",              // parsed to USDC atomic units for you
          payTo: "0xYourReceivingAddress",
        },
        description: "One market quote",
      },
    },
    new HTTPFacilitatorClient(facilitator),
    [{ network: NETWORK, server: new ExactEvmScheme() }],
  ),
);

app.get("/quote", (_req, res) => {
  res.json({ symbol: "ETH", price: 3120.44 });
});

app.listen(3000);
```

Note the import split: `paymentMiddlewareFromConfig` comes from `@x402/express`, but
`HTTPFacilitatorClient` is re-exported only from `@x402/core/server` — importing it from
`@x402/express` is a type error.

Hono and Next.js have equivalent middleware at `@x402/hono` and `@x402/next`, same
version line.

## Choosing a facilitator

The facilitator is the service that verifies the signature and broadcasts the settlement
transaction. You do not run a chain node.

- **Base mainnet — Coinbase CDP** (`@coinbase/x402`). The `facilitator` export reads
  `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` from the environment and points at
  `https://api.cdp.coinbase.com`. This is the path for real money.
- **Testnet — `https://x402.org/facilitator`**, which is the default URL baked into
  `HTTPFacilitatorClient` when you pass no config. Use Base Sepolia (`eip155:84532`) with
  testnet USDC to develop against, then flip the network and drop in the CDP facilitator.

You can also self-host a facilitator, but there's no reason to start there.

## Practical notes

- **Test on Base Sepolia first.** Change `NETWORK` to `eip155:84532` on both sides and
  drop the `@coinbase/x402` facilitator config. Nothing else changes.
- **Pricing is dynamic if you want it.** A route's `price` and `payTo` both accept a
  function of the request context, so you can charge by token count or payload size.
- **Settlement happens after your handler runs**, so a failed handler doesn't charge. If
  you do partial work, `setSettlementOverrides(res, { amount: "..." })` from
  `@x402/express` lets you settle less than the quoted price.
- **The agent's key is a hot key.** Fund it with a working balance of USDC only, and keep
  `spendControls` on.
- **Discovery is a bonus.** Routes can declare `extensions.bazaar` metadata so agents can
  find your endpoint and its price without you publishing docs.
