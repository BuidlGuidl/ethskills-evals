# Pay-per-call HTTP APIs for agents: x402 on Base

## The standard

**x402** — the HTTP `402 Payment Required` status code, finally given a protocol.
Your server answers unpaid requests with a `402` plus a JSON body describing what
it wants (amount, asset, chain, recipient). The client signs a payment
authorization, retries with an `X-PAYMENT` header, and a *facilitator* verifies
and settles it on-chain. No accounts, no API keys, no invoices — exactly the shape
you described.

On Base the default asset is USDC, and the `exact` scheme uses EIP-3009
(`transferWithAuthorization`), so the agent signs a typed-data message rather than
sending a transaction. It never needs ETH for gas — the facilitator broadcasts.

## What to install

Use the **scoped `@x402/*` packages**. All on one major (currently 2.x):

```bash
# server
npm i express @x402/express @x402/core @x402/evm @coinbase/x402

# agent client
npm i viem @x402/fetch @x402/core @x402/evm
```

Verified on npm today (2026-09-20):

| package | version |
|---|---|
| `@x402/core` | 2.26.0 |
| `@x402/evm` | 2.26.0 |
| `@x402/express` | 2.26.0 |
| `@x402/fetch` | 2.26.0 |
| `@coinbase/x402` | 2.1.0 |

### Do not use the unscoped packages

`x402`, `x402-fetch`, and `x402-express` all still resolve — and all still sit at
**1.2.0**. They are the frozen v1 line, not an older spelling of the maintained
one. If a dependency range drags one in, fix the range; don't build on it.

`@coinbase/x402` is *not* a replacement for the scoped packages — it only supplies
the Coinbase facilitator config (`facilitator`, `createFacilitatorConfig`). It sits
alongside them.

### API shapes that changed from v1

Worth stating because v1-era snippets are everywhere and they compile-fail or
silently misbehave:

- `x402Fetch` and `createWallet` **do not exist** in the scoped packages.
- `wrapFetchWithPayment(fetch, account)` is the **v1** call shape. In v2 the second
  argument is an `x402Client` / `x402HTTPClient`, not a wallet or account.
- The client scheme takes a `ClientEvmSigner`, built with
  `toClientEvmSigner(account, publicClient)`.
- Server-side, `ExactEvmScheme` comes from `@x402/evm/exact/server` and takes **no**
  signer — the facilitator settles. The client-side `ExactEvmScheme` from
  `@x402/evm` is a different class and does take one.

## Client (the agent side)

`wrapFetchWithPayment` does the whole 402 → sign → retry loop, so your agent code
is just `fetch`.

```ts
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: base, transport: http() });
const signer = toClientEvmSigner(account, publicClient);

const client = new x402Client().register(
  "eip155:8453",                  // Base mainnet, CAIP-2
  new ExactEvmScheme(signer),
);

const fetchWithPay = wrapFetchWithPayment(fetch, client);

// Pays and retries automatically on a 402.
const res = await fetchWithPay("https://api.example.com/v1/answer");
console.log(res.status, await res.json());
```

### Capping what the agent can spend

An autonomous agent paying whatever a server asks is a liability. Spend controls
are on by default (default assets only, **$1** per payment). To tighten them you
need the config form — the `x402Client` *constructor* takes a payment-requirements
selector, not a config object, so `new x402Client({ spendControls })` will not
compile:

```ts
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";

const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(signer) }],
  spendControls: { maxAmountPerPayment: "$0.10" },
});

const res = await fetchWithPay("https://api.example.com/v1/answer");

// Settlement receipt (tx hash, etc.) rides back on the response header.
const receipt = res.headers.get("x-payment-response");
if (receipt) console.log(decodePaymentResponseHeader(receipt));
```

`x402Client.fromConfig(...)` takes the same object if you want the client itself.

## Server (gating the endpoint)

```ts
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { facilitator } from "@coinbase/x402";

const BASE = "eip155:8453" as const;

const resourceServer = new x402ResourceServer(
  new HTTPFacilitatorClient(facilitator),
).register(BASE, new ExactEvmScheme());

const app = express();

app.use(
  paymentMiddleware(
    {
      "GET /v1/answer": {
        accepts: {
          scheme: "exact",
          network: BASE,
          price: "$0.02",                                 // USD string → USDC
          payTo: process.env.PAY_TO_ADDRESS as `0x${string}`,
        },
        description: "One answer from the paid API",
      },
    },
    resourceServer,
  ),
);

app.get("/v1/answer", (_req, res) => {
  res.json({ answer: 42 });
});

app.listen(4021);
```

Route keys are `"METHOD /path"`. `price` accepts a USD string (`"$0.02"`), a
suffixed token amount (`"0.02 USDC"`), or an explicit `{ amount, asset }` in atomic
units. It can also be a function of the request if you want per-call pricing.

The Coinbase facilitator reads `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` from the
environment — required for Base mainnet. For `eip155:84532` (Base Sepolia) you can
point `HTTPFacilitatorClient` at a testnet facilitator URL and skip the keys while
developing.

Useful extras on `RouteConfig`: `unpaidResponseBody` to return a teaser payload
instead of an empty 402 body, and `customPaywallHtml` / `PaywallConfig` for browsers
that hit the endpoint directly.

## How I verified this

Not from memory — every claim above was checked against the registry and the
installed artifacts today:

1. `npm view <pkg> version` for all eight package names, including the unscoped
   ones (confirmed frozen at 1.2.0).
2. Installed the scoped packages and enumerated real runtime exports — which is how
   the absence of `x402Fetch` / `createWallet` and the presence of
   `wrapFetchWithPaymentFromConfig` were established.
3. Read the shipped `.d.ts` files for `wrapFetchWithPayment`, `paymentMiddleware`,
   `RouteConfig`, `x402Client`, `SpendControls`, and `toClientEvmSigner`.
4. Compiled both the server and client snippets above with `tsc --strict` against
   the installed packages: **typecheck passed**. The `spendControls` variant was
   caught failing in the constructor form first, then fixed to `fromConfig` — the
   version in this document is the one that compiles.

Not verified: no payment was settled against a live facilitator, so mainnet
credentials and on-chain behaviour are still worth a testnet run before you ship.
