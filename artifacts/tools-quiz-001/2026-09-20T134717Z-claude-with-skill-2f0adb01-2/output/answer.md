# Paid API for agents: x402 on Base

**The standard is x402** — an open protocol that puts payment inline in the HTTP
request using the long-dormant `402 Payment Required` status code. Exactly your
shape: no accounts, no API keys, no invoicing.

The flow:

1. Agent calls your endpoint with no payment.
2. Your server returns **402** plus a JSON body describing what it accepts
   (scheme, price, network, `payTo` address).
3. The client signs a stablecoin authorization (EIP-3009 / Permit2 — a
   signature, not a transaction, so the agent pays no gas) and retries with a
   `PAYMENT` header.
4. Your server hands the payload to a **facilitator**, which verifies and
   settles it on-chain, then your handler runs and returns the real response.

Settlement is USDC on Base. Cents-per-call is the intended range.

## What to install

Protocol v2 lives under the **`@x402/*` scope**. Versions below are what
resolved from npm on 2026-09-20 in a clean install.

**Server (Express):**

```bash
npm install @x402/core @x402/evm @x402/express @coinbase/x402 express
```

**Client (TypeScript agent):**

```bash
npm install @x402/core @x402/evm @x402/fetch viem
```

| Package | Version | Role |
|---|---|---|
| `@x402/core` | 2.26.0 | Protocol types, `x402ResourceServer`, `HTTPFacilitatorClient` |
| `@x402/evm` | 2.26.0 | EVM payment schemes (`exact`, `upto`, …) |
| `@x402/fetch` | 2.26.0 | `fetch` wrapper that auto-pays and retries |
| `@x402/express` | 2.26.0 | `paymentMiddleware` for Express |
| `@coinbase/x402` | 2.1.0 | CDP facilitator config — **needed for Base mainnet** |
| `viem` | 2.56.8 | Account/signing |

> **Two naming generations exist — pick the scoped one.** The older unscoped
> packages (`x402`, `x402-fetch`, `x402-express`, `x402-axios`, `x402-next`)
> still resolve at `1.2.x`, but they are protocol v1 and were last published
> 2026-04-16. The scoped `@x402/*` line is at 2.26.0, published 2026-09-15.
> Build new code on the scoped packages.

Other runtimes: `@x402/hono`, `@x402/next`, `@x402/axios` follow the same
scoped pattern. Python is `pip install x402`; Go is
`go get github.com/coinbase/x402/go`.

## Client code

This is the whole agent side — one wrapper, then normal `fetch`.

```typescript
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    { network: "eip155:8453", client: new ExactEvmScheme(account) }, // Base mainnet
  ],
});

// Call it exactly like fetch. The 402 → sign → retry cycle is handled inside.
const res = await fetchWithPayment("https://api.example.com/quote", { method: "GET" });
const data = await res.json();

// Optional: inspect what was actually settled on-chain.
const header = res.headers.get("PAYMENT-RESPONSE");
if (header) console.log(decodePaymentResponseHeader(header));

console.log(data);
```

Notes on the API, since it is easy to get wrong:

- The export is **`wrapFetchWithPaymentFromConfig`** (or `wrapFetchWithPayment`
  if you build an `x402Client` yourself). There is no `x402Fetch` export, and
  no `createWallet` — you bring a plain viem account.
- Networks are **CAIP-2 identifiers**: `eip155:8453` for Base mainnet,
  `eip155:84532` for Base Sepolia. `eip155:*` accepts any EVM chain the server
  offers, which is a reasonable default for an agent.
- Fund the agent's address with USDC on Base. It needs no ETH — settlement gas
  is paid by the facilitator.

## Server code

```typescript
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { facilitator } from "@coinbase/x402"; // reads CDP_API_KEY_ID / CDP_API_KEY_SECRET

const app = express();

const resourceServer = new x402ResourceServer(new HTTPFacilitatorClient(facilitator))
  .register("eip155:8453", new ExactEvmScheme());

app.use(
  paymentMiddleware(
    {
      "GET /quote": {
        accepts: {
          scheme: "exact",
          price: "$0.02",
          network: "eip155:8453",
          payTo: "0xYourReceivingAddress",
        },
        description: "One quote",
      },
    },
    resourceServer,
  ),
);

// Runs only after payment verifies. Settlement happens after you respond.
app.get("/quote", (_req, res) => res.json({ ok: true }));

app.listen(3000);
```

`price` takes a dollar string like `"$0.02"` and is resolved to USDC units for
the chosen network. Route keys are `"<METHOD> <path>"`.

## The facilitator is the part that bites

A facilitator does the verify + on-chain settle so your server never touches a
private key or pays gas. **Which one you use decides whether you can charge
real money.**

I queried the free public facilitator at `https://x402.org/facilitator/supported`
today. It advertises `eip155:84532` — **Base Sepolia only**. No `eip155:8453`.
So it is fine for development and useless for revenue.

For Base **mainnet** you need a facilitator that settles there; Coinbase CDP is
the default, which is why `@coinbase/x402` is in the server dependency list.
Sign up for CDP API keys and set `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` — the
exported `facilitator` object reads them. Develop against
`eip155:84532` + `https://x402.org/facilitator`, then flip the network and
facilitator for production.

## Verification performed

Not asserted from memory — actually run on 2026-09-20:

- `npm view` on all candidate names. Both generations resolve; recorded the
  version and publish-date split above.
- Clean `npm install` of `@x402/core @x402/evm @x402/fetch @x402/express
  @coinbase/x402 express viem` — succeeded, 0 vulnerabilities.
- Read the exported symbols out of the shipped `.d.ts` files to confirm real
  names (`wrapFetchWithPayment`, `wrapFetchWithPaymentFromConfig`,
  `paymentMiddleware`, `x402ResourceServer`, `HTTPFacilitatorClient`,
  `ExactEvmScheme`, `decodePaymentResponseHeader`) and the `@x402/evm`
  subpath exports (`./exact/client`, `./exact/server`).
- **Compiled both snippets above with `tsc --strict` against the installed
  packages. Exit code 0, no errors.** The only edit to the server file was a
  placeholder `payTo` address.
- `curl`'d the public facilitator's `/supported` endpoint to establish the
  testnet-only limitation.

Not verified: no live payment was settled end-to-end, since that needs CDP
credentials and a funded wallet.

## Docs

- https://www.x402.org
- https://github.com/x402-foundation/x402 (the repo the scoped packages point to)
