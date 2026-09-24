# Paid API for AI agents: x402 on Base

The standard answer today is **x402** — an open protocol that revives HTTP `402 Payment Required`.
Your server answers unpaid requests with a 402 describing what it wants; the client signs a stablecoin
payment authorization, retries with an `X-PAYMENT` header, and a **facilitator** verifies and settles
it on-chain. No accounts, no API keys, no invoicing — exactly the shape you asked for.

Payment is a signed **EIP-3009 / Permit2 authorization over USDC**, not a transaction the agent
broadcasts itself. The agent needs no gas — the facilitator submits settlement. That's what makes
cent-sized calls viable.

## Install exactly this

```bash
# Server (Express)
npm install express @x402/express @x402/core @x402/evm @coinbase/x402

# Agent client (TypeScript)
npm install @x402/fetch @x402/core @x402/evm viem
```

Verified on npm on 2026-09-20 — all resolve and install cleanly together:

| Package | Version |
|---|---|
| `@x402/core`, `@x402/evm`, `@x402/fetch`, `@x402/express` | 2.26.0 |
| `@coinbase/x402` | 2.1.0 |
| `viem` | 2.56.8 |

### Heads-up on package names

There are **two generations on npm**, and the older one is easy to pick by mistake:

- `x402-fetch`, `x402-express`, `x402-axios` (unscoped, **v1.x**) — last published April 2026.
- `@x402/fetch`, `@x402/express`, … (scoped, **v2.26.0**) — published 5 days ago, actively maintained.

Use the **scoped `@x402/*`** packages. They are not drop-in compatible with v1: the protocol version
on the wire is `x402Version: 2`, and the APIs differ.

Two further name traps I hit while verifying:

- **`ExactEvmScheme` exists twice.** `@x402/evm/exact/client` exports the client one (takes a signer);
  `@x402/evm/exact/server` exports the server one (takes no arguments). The bare `@x402/evm` re-exports
  the *client* version, so importing it on the server fails to typecheck. Import from the explicit
  subpath on each side.
- A `x402Fetch()` / `createWallet()` API does **not** exist. The real exports are
  `wrapFetchWithPayment` and `toClientEvmSigner`.

## Client (the agent) — pays and retries automatically

`wrapFetchWithPayment` returns a drop-in `fetch`. Your call sites don't change; the 402, the signature,
and the retry are handled inside.

```typescript
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: base, transport: http() });

// viem 2.56's generic `readContract` doesn't structurally match the signer
// interface, so narrow it explicitly. Passing `publicClient` whole fails tsc.
const signer = toClientEvmSigner(account, {
  readContract: (a) => publicClient.readContract(a as never),
});

const client = new x402Client().register("eip155:8453", new ExactEvmScheme(signer));
const fetchWithPay = wrapFetchWithPayment(fetch, client);

// Ordinary fetch call. If it 402s, payment + retry happen transparently.
const res = await fetchWithPay("https://api.example.com/paid");
console.log(await res.json());
```

Networks are **CAIP-2** ids: Base mainnet is `eip155:8453`, Base Sepolia is `eip155:84532`.

## Server — gate the endpoint

```typescript
import express from "express";
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { facilitator } from "@coinbase/x402";

const app = express();

const server = new x402ResourceServer(new HTTPFacilitatorClient(facilitator))
  .register("eip155:8453", new ExactEvmScheme());

app.use(paymentMiddleware({
  "GET /paid": {
    accepts: {
      scheme: "exact",
      network: "eip155:8453",
      price: "$0.01",              // plain USD string; SDK converts to USDC units
      payTo: process.env.PAY_TO!,  // your receiving address
    },
  },
}, server));

app.get("/paid", (_req, res) => res.json({ ok: true }));
app.listen(3000);
```

`price: "$0.01"` is the whole pricing story — no token math, no decimals.

## What I actually verified

Both files above typecheck clean under `tsc --module nodenext` against the installed packages
(the import-subpath and `readContract` notes are fixes for errors the compiler really raised).

I also ran the server and hit it with an unpaid request. Against the keyless testnet facilitator
(`https://x402.org/facilitator`, Base Sepolia) it returns a genuine **402**:

```
STATUS: 402
{"x402Version":2,"error":"Payment required",
 "resource":{"url":"http://localhost:3112/paid"},
 "accepts":[{"scheme":"exact","network":"eip155:84532","amount":"10000",
   "asset":"0x036CbD53842c5426634e7929541eC2318f3dCF7e",
   "payTo":"0x...","maxTimeoutSeconds":300,
   "extra":{"name":"USDC","version":"2"}}]}
```

`$0.01` correctly became `amount: "10000"` (6-decimal USDC) against the real Base Sepolia USDC
contract. Note the requirements ride in a base64 **`payment-required` response header** in v2 — the
JSON body is empty (`{}`). Don't parse the body looking for them.

### Two operational gotchas, both hit for real

1. **The Coinbase facilitator requires CDP credentials.** `@coinbase/x402`'s `facilitator` against
   Base mainnet returned `getSupported failed (401): Unauthorized`. Create a CDP API key at
   portal.cdp.coinbase.com and set `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` before mainnet works.
   Develop against `https://x402.org/facilitator` on Base Sepolia, which needs no key.
2. **Don't disable facilitator sync.** The middleware's 5th argument (`syncFacilitatorOnStart`)
   defaults to `true`, and it must stay that way. Setting it to `false` made every request fail with
   a **500**, not a 402 — the server never learned the facilitator supports `exact` on your network.
   Startup is async, so the first request or two after boot can race this.

## Recommendation

Ship the Express middleware with the Coinbase facilitator on Base mainnet, and have agents use
`wrapFetchWithPayment`. Settlement is USDC, so you receive stablecoin, and the agent needs no gas
and no account with you. Build against Base Sepolia and the keyless facilitator first — you'll get
the whole loop working before touching CDP keys.

There are equivalent middlewares if you're not on Express: `@x402/next`, `@x402/hono`.
For an axios-based client, `@x402/axios` provides the same interceptor pattern.
