# Pay-per-call HTTP APIs with x402 (Base)

## The short answer

The standard for this is **x402** — an HTTP-native payment protocol built on the
long-dormant `402 Payment Required` status code. Your server returns `402` with
machine-readable payment requirements; the client signs a stablecoin transfer
authorization, retries with an `X-PAYMENT` header, and a **facilitator** verifies
and settles it on-chain. No accounts, no API keys, no invoicing — exactly the
shape you described.

Use the scoped `@x402/*` packages. Everything below was installed and executed on
2026-09-20 against the versions listed.

## What to install

**Server (Express):**

```bash
npm i @x402/core @x402/express @x402/evm @coinbase/x402 express
```

**Agent client (TypeScript):**

```bash
npm i @x402/core @x402/fetch @x402/evm viem
```

Verified resolved versions (`npm view`, 2026-09-20):

| Package | Version |
|---|---|
| `@x402/core` | 2.26.0 |
| `@x402/evm` | 2.26.0 |
| `@x402/express` | 2.26.0 |
| `@x402/fetch` | 2.26.0 |
| `@coinbase/x402` | 2.1.0 |
| `viem` | 2.56.8 |
| `express` | 5.2.1 |

Keep every `@x402/*` package on the same major (2.x) — they share internal types
and mixing majors breaks the scheme registration types.

### Packages to avoid

The **unscoped** `x402`, `x402-fetch`, and `x402-express` packages still exist on
npm but are frozen at **1.2.0** — an older protocol generation, not an older
spelling of the same thing. Don't let a dependency resolver pull you back to them.

`@coinbase/x402` is *not* an alternative to the scoped family — it only exports
Coinbase facilitator config (`facilitator`, `createFacilitatorConfig`,
`createCdpAuthHeaders`). It sits alongside `@x402/express`, and you only need it
if you use Coinbase's facilitator.

Also note: `x402Fetch` and `createWallet` do not exist in these packages, and
passing a viem account directly to `wrapFetchWithPayment` is the frozen v1 call
shape. In 2.x, `wrapFetchWithPayment(fetch, client)` takes an **x402 client**,
and the account goes into the scheme (`new ExactEvmScheme(account)`).

## Client code (the agent side)

```ts
// client.ts
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`);

// Register the "exact" payment scheme for Base mainnet (CAIP-2: eip155:8453).
const client = new x402Client().register("eip155:8453", new ExactEvmScheme(account));

// Drop-in replacement for fetch: handles 402 -> sign -> retry automatically.
const fetchWithPay = wrapFetchWithPayment(fetch, client);

const res = await fetchWithPay("https://api.example.com/v1/quote");
console.log(res.status, await res.json());
```

That's the whole client. `fetchWithPay` makes the request, and on a `402` it
parses the requirements, signs an EIP-3009 / Permit2 authorization with the
account, and replays the request with the payment header. Your agent code just
calls `fetchWithPay` instead of `fetch`.

A viem `LocalAccount` satisfies the `ClientEvmSigner` type directly — no adapter
needed. (`toClientEvmSigner(account, publicClient)` exists if you want the
optional on-chain-read capabilities for gas-sponsoring extensions.)

For a spend cap, use `x402Client.fromConfig({...})`, which accepts `policies` and
`spendControls` alongside the scheme registrations — worth setting for an
autonomous agent so a misbehaving loop can't drain the key.

## Server code (the gate)

```ts
// server.ts
import express from "express";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { facilitator } from "@coinbase/x402"; // reads CDP_API_KEY_ID / CDP_API_KEY_SECRET

const app = express();
const BASE = "eip155:8453" as const;

app.use(
  paymentMiddlewareFromConfig(
    {
      "GET /v1/quote": {
        accepts: [
          {
            scheme: "exact",
            network: BASE,
            price: "$0.02",              // USD string; resolved to USDC base units
            payTo: "0xYourReceivingAddress",
          },
        ],
        description: "One quote",
      },
    },
    new HTTPFacilitatorClient(facilitator),
    [{ network: BASE, server: new ExactEvmScheme() }],
  ),
);

app.get("/v1/quote", (_req, res) => {
  res.json({ ok: true, data: "paid content" });
});

app.listen(3000);
```

Note the **server** `ExactEvmScheme` comes from `@x402/evm/exact/server` and takes
no signer — it's the verifying side. The **client** `ExactEvmScheme` from
`@x402/evm` takes the account. Same class name, two different subpaths; importing
the wrong one is the easiest mistake to make here.

## Two things that will bite you

**1. The middleware must reach the facilitator at startup.** It calls
`/supported` to learn which scheme/network pairs are settleable. I confirmed this
by disabling it:

```
Error: Facilitator does not support exact on eip155:8453.
Make sure to call initialize() to fetch supported kinds from facilitators.
```

`paymentMiddlewareFromConfig` has a trailing `syncFacilitatorOnStart` parameter
that defaults to `true`. **Leave it alone.** Setting it to `false` produces the
error above and every protected request 500s.

**2. The Coinbase facilitator requires CDP credentials.** Unauthenticated calls
to `https://api.cdp.coinbase.com/platform/v2/x402/supported` return `401
Unauthorized` (confirmed today), which makes the server fail to initialize. For
Base mainnet you need `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` in the
environment from the Coinbase Developer Platform, which the `facilitator` export
picks up automatically.

For development you can skip credentials entirely by pointing at the public
testnet facilitator on Base Sepolia:

```ts
new HTTPFacilitatorClient({ url: "https://x402.org/facilitator" })
// and network: "eip155:84532"
```

## Verification performed

Everything above was run, not recalled:

- **Registry check.** `npm view` confirmed the scoped family at 2.26.0 (published
  2026-09-15) and the unscoped `x402` / `x402-fetch` / `x402-express` at 1.2.0.
- **Type check.** Both files above were compiled with `tsc --strict`
  (TypeScript 5.9.3, `moduleResolution: NodeNext`) against the installed
  packages. Exit code 0, no errors — the signatures are read off the shipped
  `.d.ts` files, not from memory.
- **End-to-end run on Base Sepolia.** Server started against
  `https://x402.org/facilitator`; an unpaid `curl` returned a real
  `HTTP/1.1 402 Payment Required` with a `PAYMENT-REQUIRED` header whose decoded
  body priced `$0.02` as `"amount":"20000"` of USDC
  `0x036CbD53842c5426634e7929541eC2318f3dCF7e`. The client above then ran against
  it and printed:

  ```
  CLIENT status: 200 {"ok":true,"data":"paid content"}
  ```

  Full round trip: 402 → sign → retry → settled → paid content.

The only thing I could not exercise is Base **mainnet** settlement, which needs
your CDP keys and a funded agent wallet. The wiring is identical — swap
`eip155:84532` for `eip155:8453` on both sides and supply the credentials.

## If you're not on Express

Same `@x402/core` underneath, different adapter: `@x402/hono`, `@x402/next`, and
`@x402/axios` (2.26.0) exist for those stacks. On the client, `@x402/axios`
wraps an Axios instance the way `@x402/fetch` wraps `fetch`. For a Go client, the
module path is `github.com/x402-foundation/x402/go/v2` — the older
`github.com/coinbase/x402/go` path resolves to a stale pre-Foundation commit
without erroring.
