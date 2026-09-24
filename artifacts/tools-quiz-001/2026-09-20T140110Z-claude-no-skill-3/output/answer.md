# Paid API for AI agents: x402 on Base

## The short answer

The standard is **x402** — an open protocol that revives HTTP `402 Payment Required`.
Your server answers unpaid requests with a `402` describing what it wants; the client signs
a stablecoin payment authorization, resends it in an `X-PAYMENT` header, and gets the real
response. No accounts, no API keys, no invoicing — exactly the shape you asked for.

Payment is an **EIP-3009 / Permit2 signature**, not a transaction the agent broadcasts. The
agent spends no gas. A **facilitator** verifies the signature and settles it on Base for you.

**Install this (verified against npm on 2026-09-20):**

```bash
# server
npm i @x402/express @x402/core @x402/evm @coinbase/x402 express

# agent client
npm i @x402/fetch @x402/core @x402/evm viem
```

## Read this before you copy a tutorial

There are **two parallel package families on npm**, and most existing material targets the dead one.

| | unscoped `x402`, `x402-express`, `x402-fetch` | scoped `@x402/core`, `@x402/express`, `@x402/fetch` |
|---|---|---|
| Latest | `1.2.0` / `1.2.1` | `2.26.0` |
| Last published | 2026-04-16 (5 months stale) | 2026-09-15 (5 days ago) |
| Status | v1 line, superseded | current, actively released in lockstep |

Two things I confirmed by installing rather than by reading docs:

1. **`npm i x402-axios` is broken right now.** Its `latest` tag, `1.2.1`, declares a dependency
   on `x402@^1.2.1` — and `x402` was never published past `1.2.0`. The install fails outright
   with `ETARGET: No matching version found for x402@^1.2.1`. If you are pinned to v1 for some
   reason, `x402-axios@1.2.0` is the last installable version. This alone is a good reason to
   start on the 2.x line.
2. **The 2.x API is not the 1.x API.** Networks are CAIP-2 strings (`eip155:8453` for Base
   mainnet, `eip155:84532` for Base Sepolia) rather than `"base"`, and the client is now an
   explicit `x402Client` with registered schemes. Every v1 snippet you find will need rewriting.

Everything below is written against 2.26.0, compiled with `tsc --strict`, and the imports were
loaded at runtime to confirm the symbols actually exist.

## Client — the agent side

This is the part you asked to see. `wrapFetchWithPayment` returns a drop-in `fetch` that
transparently handles the 402: first request, parse requirements, sign, retry with payment.

```ts
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { x402Client, wrapFetchWithPayment, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: base, transport: http() });

const client = new x402Client().register(
  "eip155:8453",                                        // Base mainnet, CAIP-2
  new ExactEvmScheme(toClientEvmSigner(account, publicClient)),
);

const fetchWithPay = wrapFetchWithPayment(fetch, client);

// Pays and retries automatically. Caller sees only the 200.
const res = await fetchWithPay("https://api.example.com/v1/answer");
console.log(await res.json());

// Settlement details (tx hash, payer) come back on the response header.
const header = res.headers.get("x-payment-response");
if (header) console.log(decodePaymentResponseHeader(header));
```

`toClientEvmSigner(account, publicClient)` is what you want over passing `account` bare — a
plain `privateKeyToAccount` has no `readContract`, and the scheme needs on-chain reads for
Permit2 allowance checks and EIP-2612 gas sponsoring.

### Cap what the agent can spend

An agent paying automatically should have a ceiling. Spend controls are **on by default** at
`$1` per payment and default-assets-only (USDC and friends), which is a sane failsafe, but
for a few-cents API you want it much tighter:

```ts
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";

export const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{
    network: "eip155:8453",
    client: new ExactEvmScheme(toClientEvmSigner(account, publicClient)),
  }],
  spendControls: { maxAmountPerPayment: "$0.05" },   // reject anything pricier
});
```

Now a server that suddenly asks for $5 gets refused by the client instead of paid.

## Server — gating the endpoint

```ts
import express from "express";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";   // server scheme, not the client one
import { facilitator } from "@coinbase/x402";

const BASE = "eip155:8453" as const;
const app = express();

app.use(
  paymentMiddlewareFromConfig(
    {
      "GET /v1/answer": {
        accepts: {
          scheme: "exact",
          network: BASE,
          price: "$0.02",                              // priced in USD, settled in USDC
          payTo: process.env.PAY_TO as `0x${string}`,  // your wallet
        },
        description: "One model answer",
      },
    },
    new HTTPFacilitatorClient(facilitator),
    [{ network: BASE, server: new ExactEvmScheme() }],
  ),
);

// Only ever reached once payment verified; middleware settles after it returns.
app.get("/v1/answer", (_req, res) => { res.json({ answer: 42 }); });

app.listen(3000);
```

Note the import path: `@x402/evm/exact/server` exports a *different* `ExactEvmScheme` than the
package root. The root one implements `SchemeNetworkClient` (for paying); the `/exact/server`
one implements `SchemeNetworkServer` (for accepting). They share a name and are not
interchangeable — using the root export here is a type error.

Same middleware, other frameworks: `@x402/hono`, `@x402/next`, all at 2.26.0.

## Choosing a facilitator

The facilitator verifies signatures and pushes settlement on-chain.

- **Base mainnet** needs Coinbase CDP. `facilitator` from `@coinbase/x402` resolves to
  `https://api.cdp.coinbase.com/platform/v2/x402` and signs requests with CDP API keys
  (`CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` in the environment). Get those from the CDP portal.
- **Base Sepolia** needs no keys — bare `new HTTPFacilitatorClient()` defaults to
  `https://x402.org/facilitator`. Develop against `eip155:84532` first.

One caveat on `@coinbase/x402`: it is at `2.1.0`, last published 2025-12-23, while the
`@x402/*` family is at 2.26.0 from five days ago. It declares `@x402/core: ^2.0.0`, so it
resolves and the `FacilitatorConfig` it returns is accepted by `HTTPFacilitatorClient` — I
verified both. But it moves on a slower cadence than the rest, so treat a break there as
plausible and pin deliberately.

## Practical notes

- **Price in USD, settle in USDC.** `price: "$0.02"` is resolved against the network's default
  asset. Cents-scale pricing works because settlement is a signature, not a per-call gas spend.
- **Test on Sepolia first.** Swap `eip155:8453` → `eip155:84532`, `base` → `baseSepolia`, and
  drop the CDP facilitator. Nothing else changes.
- **The agent's key is a hot wallet.** It signs unattended. Fund it with working balance only,
  and keep `spendControls` narrow.
- **Browsers get a paywall.** If a request arrives with `Accept: text/html`, the middleware can
  serve an HTML paywall instead of a raw 402, via the optional `@x402/paywall` peer dependency.
  Irrelevant for agent-only traffic — skip installing it.
- `npm i` on this stack tries to build `bufferutil` natively. In a sandbox without a compiler,
  `--ignore-scripts` installs fine; it is an optional `ws` accelerator, not a requirement.

## Verification performed

- Resolved every package named here against the live npm registry on 2026-09-20.
- Reproduced the `x402-axios@1.2.1` → `x402@^1.2.1` `ETARGET` failure, and confirmed `x402`
  never published past `1.2.0` by listing all 33 published versions.
- Installed `@x402/core`, `@x402/express`, `@x402/fetch`, `@x402/evm`, `@coinbase/x402`,
  `express`, `viem` clean (0 vulnerabilities).
- Read the shipped `.d.ts` for every signature used above rather than recalling the API.
- Compiled all three snippets with `tsc --strict` — exit 0, no errors.
- Imported each module at runtime and confirmed the exported symbols and the resolved
  facilitator URLs.
