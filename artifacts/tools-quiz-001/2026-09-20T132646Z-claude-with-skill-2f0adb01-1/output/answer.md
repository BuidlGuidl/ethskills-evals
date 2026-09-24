# Paid API for AI agents: x402 on Base

## The short answer

The standard is **x402** — an open payment protocol built on the long-dormant HTTP `402 Payment Required` status code. It does exactly what you described: no accounts, no API keys, no invoicing. Payment happens inline in the request.

The flow:

1. Agent calls your endpoint with no payment.
2. Your server replies `402` with a `PAYMENT-REQUIRED` header describing what it wants (amount, asset, chain, recipient).
3. The client signs an **EIP-3009 `transferWithAuthorization`** for USDC — a signature, not a transaction, so the agent needs no gas.
4. The client retries with an `X-PAYMENT` header.
5. A **facilitator** verifies the signature and settles it on-chain. Your server returns the real response.

The agent pays a few cents in USDC on Base. Your server never handles a private key.

## What to install

Server (Express):

```bash
npm install @x402/express @x402/evm @x402/core express
```

Client (TypeScript agent):

```bash
npm install @x402/fetch @x402/evm viem
```

For Base **mainnet** you also need the Coinbase facilitator:

```bash
npm install @coinbase/x402
```

### Verified versions

Installed and typechecked on 2026-09-20:

| Package | Version |
|---|---|
| `@x402/core` | 2.26.0 |
| `@x402/evm` | 2.26.0 |
| `@x402/express` | 2.26.0 |
| `@x402/fetch` | 2.26.0 |
| `@coinbase/x402` | 2.1.0 |
| `viem` | 2.56.8 |
| `express` | 5.2.1 |

### Note on package naming — this trips people up

There are **two** live generations on npm:

- **`@x402/*` (scoped), v2.x** — the current line. Maintained by the x402 Foundation, latest publish 2026-09-15. Use this.
- **`x402-express`, `x402-fetch`, `x402-axios` (unscoped), v1.2.x** — the older v1 line. Still installable, not formally deprecated, but last touched 2026-04-16. Most blog posts and older docs you'll find reference these.

They are not interchangeable: v1 uses plain network names (`"base"`), v2 uses CAIP-2 identifiers (`"eip155:8453"`). The v2 packages can talk to v1 clients via `registerSchemeV1`, but don't mix the import styles. Everything below is v2.

## Client code

This is the whole agent side. `wrapFetchWithPaymentFromConfig` returns a drop-in `fetch` that transparently handles the 402-sign-retry cycle.

```typescript
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: "eip155:8453", // Base mainnet
      client: new ExactEvmScheme(toClientEvmSigner(account)),
    },
  ],
});

// Just call it. The payment and retry happen inside.
const res = await fetchWithPayment("https://api.example.com/quote", { method: "GET" });
const data = await res.json();

// Optional: inspect the on-chain settlement
const header = res.headers.get("x-payment-response");
if (header) {
  console.log(decodePaymentResponseHeader(header));
}
```

The agent's wallet just needs USDC on Base. No ETH for gas — the facilitator submits the transaction.

## Server code

```typescript
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { facilitator } from "@coinbase/x402";

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
        description: "One market quote",
      },
    },
    resourceServer,
  ),
);

app.get("/quote", (_req, res) => {
  res.json({ symbol: "ETH", price: 3421.55 });
});

app.listen(4021);
```

Note `ExactEvmScheme` is imported from `@x402/evm/exact/**server**` here and `@x402/evm/exact/**client**` in the agent. Same name, different subpath, different implementation — the server one takes no signer.

## The facilitator gotcha — check this before you ship

**The free public facilitator at `https://x402.org/facilitator` does not support Base mainnet.** I hit this on a live boot, not in the docs:

```
RouteConfigurationError: x402 Route Configuration Errors:
  - Route "GET /quote": Facilitator does not support scheme "exact" on network "eip155:8453"
```

Querying `https://x402.org/facilitator/supported` confirms it: the EVM entries are `eip155:84532` (Base **Sepolia**) only. It's a testnet facilitator, plus testnets on Solana/Algorand/Aptos/Stellar/Hedera/XRPL.

So:

- **Base Sepolia (development):** use `new HTTPFacilitatorClient({ url: "https://x402.org/facilitator" })` with `network: "eip155:84532"`. Free, no credentials.
- **Base mainnet (production):** use `@coinbase/x402`'s `facilitator` export, which needs `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` from the [Coinbase Developer Platform](https://www.coinbase.com/developer-platform). The `verify` and `settle` endpoints both require auth.

Usefully, the middleware validates routes against the facilitator **at startup**, so a misconfiguration crashes on boot rather than failing on a customer's first call.

## Confirmation that this actually works

I didn't just check that the packages resolve. Both files above typecheck clean under TypeScript 7.0.2 with `strict` and `moduleResolution: NodeNext`, and I ran the server against the live facilitator on Base Sepolia. An unpaid request returns:

```
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOiJQYXltZW50...
```

Base64-decoding that header:

```json
{
  "x402Version": 2,
  "error": "Payment required",
  "resource": {
    "url": "http://localhost:4021/quote",
    "description": "One market quote"
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:84532",
      "amount": "20000",
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "payTo": "0x857f1ac8Ff0c0FBfC5B4c34b0Cc0A1B0eF63D4f7",
      "maxTimeoutSeconds": 300,
      "extra": { "name": "USDC", "version": "2" }
    }
  ]
}
```

`"$0.02"` correctly became `amount: "20000"` (USDC has 6 decimals) against the Base Sepolia USDC contract. The price string is parsed for you; you don't convert to base units yourself.

## Practical notes

- **Amounts.** A few cents per call is exactly the target range. Settlement is a single USDC transfer on Base, so fees are small fractions of a cent.
- **Other frameworks.** `@x402/hono`, `@x402/next` exist alongside `@x402/express` if you're not on Express.
- **Validity window.** v2 defaults to a 1-hour authorization window; `maxTimeoutSeconds` (300 above) bounds how long your server will wait for settlement.
- **Other languages.** Python `x402`, Go `github.com/coinbase/x402/go`.
- **Testing.** Build on Base Sepolia first with the free facilitator, then flip the network to `eip155:8453` and swap in the CDP facilitator. Those are the only two changes.
- **Docs.** <https://x402.org> and <https://github.com/x402-foundation/x402>.
