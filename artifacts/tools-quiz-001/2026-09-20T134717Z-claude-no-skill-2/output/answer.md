# Charging AI agents per API call, settled on Base

## The short answer

The standard for this is **x402** — an open protocol that puts payment inline in the
HTTP request using the long-dormant `402 Payment Required` status code. The flow is
exactly what you described:

1. Agent calls your endpoint with no credentials.
2. Your server replies `402` with a `PAYMENT-REQUIRED` header describing what to pay
   (amount, asset, chain, your address).
3. The client signs an **EIP-3009 `transferWithAuthorization`** for exactly that amount
   and retries with a `PAYMENT-SIGNATURE` header.
4. Your middleware hands that to a *facilitator*, which verifies and settles on-chain,
   then your handler runs and returns the real response.

No accounts, no API keys, no invoicing. The agent's wallet signs a USDC authorization;
it never needs gas, because the facilitator broadcasts the transaction.

**Important:** there are two generations of x402 packages on npm right now, and most
tutorials you'll find point at the older one. Details in "Which packages" below —
this matters, because one of the old packages is currently uninstallable.

## Which packages (this is the part to get right)

| Line | Packages | Latest | Last published |
|---|---|---|---|
| Legacy, unscoped | `x402`, `x402-fetch`, `x402-express` | 1.2.0 | 2026-04-16 |
| **Current, scoped** | `@x402/core`, `@x402/fetch`, `@x402/express`, `@x402/evm` | **2.26.0** | **2026-09-15** |

Use the scoped `@x402/*` line. It's the actively maintained one — five days old as of
today versus five months for the unscoped packages — and it's what `@coinbase/x402@2`
now depends on (`@x402/core`, not `x402`).

Two things I confirmed by installing rather than reading docs:

- **`x402-axios@latest` does not install at all.** Version 1.2.1 declares a dependency
  on `x402@^1.2.1`, but `x402` was never published past 1.2.0. `npm i x402-axios` fails
  with `ETARGET: No matching version found for x402@^1.2.1`. If you're wedded to axios
  on the old line you'd have to pin `x402-axios@1.2.0`; on the new line use
  `@x402/axios@2.26.0`, which is fine.
- The old line installed with 26 npm audit warnings (25 moderate, 1 high); the scoped
  line installed clean with 0.

### Install

Server:

```bash
npm i express @x402/express @x402/core @x402/evm @coinbase/x402
```

Client (the agent):

```bash
npm i viem @x402/fetch @x402/core @x402/evm
```

Swap `@x402/express` for `@x402/hono` or `@x402/next` if that's your stack — same
version, same shape. Use `@x402/axios` instead of `@x402/fetch` if the agent uses axios.

All of the above resolve today; versions I actually got were `@x402/*@2.26.0`,
`@coinbase/x402@2.1.0`, `viem@2.56.8`, `express@5.2.1`.

## Client code (the agent side)

This is the whole thing. `wrapFetchWithPayment` returns a drop-in `fetch` that
transparently handles the 402 → sign → retry loop.

```ts
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`);

// "eip155:8453" is Base mainnet in CAIP-2 form. Base Sepolia is "eip155:84532".
const client = new x402Client().register("eip155:8453", new ExactEvmScheme(account));

const fetchWithPay = wrapFetchWithPayment(fetch, client);

// Ordinary fetch call. Payment happens inline, invisibly.
const res = await fetchWithPay("https://api.example.com/v1/answer");
console.log(await res.json());
```

A viem account satisfies the signer interface directly — it only needs `address` and
`signTypedData`, so there's no wallet-client plumbing.

### Capping what the agent will spend

By default the client refuses to pay more than **$1 per call** and only pays in
recognized default assets (USDC). To tighten that to your few-cents range, build the
client from config instead:

```ts
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";

const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
  spendControls: { maxAmountPerPayment: "$0.05" },
});
```

This is worth setting. It's the one guardrail between a looping agent and your
counterparty's price field.

## Server code (your side)

```ts
import express from "express";
import { paymentMiddleware } from "@x402/express";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { facilitator } from "@coinbase/x402";

const PAY_TO = process.env.PAY_TO as `0x${string}`;
const NETWORK = "eip155:8453";

const resourceServer = new x402ResourceServer(
  new HTTPFacilitatorClient(facilitator),
).register(NETWORK, new ExactEvmScheme());

// Fetches supported scheme/network pairs from the facilitator.
// Await this before serving traffic — see the gotcha below.
await resourceServer.initialize();

const app = express();

app.use(
  paymentMiddleware(
    {
      "GET /v1/answer": {
        accepts: {
          scheme: "exact",
          network: NETWORK,
          price: "$0.02",
          payTo: PAY_TO,
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

app.listen(3000);
```

Note the import asymmetry, which is easy to get wrong: the **client** scheme is
`ExactEvmScheme` from `@x402/evm`, the **server** scheme is a different class with the
same name from `@x402/evm/exact/server`. Importing the client one server-side is a type
error (`missing properties ... parsePrice, enhancePaymentRequirements`), so TypeScript
will catch it, but the identical name makes the message confusing.

## Three things that will bite you

**1. Await `initialize()`.** There's a convenience wrapper,
`paymentMiddlewareFromConfig(routes, facilitatorClient, schemes)`, with a
`syncFacilitatorOnStart` flag that's supposed to do this for you. In my testing it did
not work — every request 500'd with `Facilitator does not support exact on
eip155:84532. Make sure to call initialize()`, and it stayed broken across repeated
requests over ~20 seconds, so it isn't just a startup race. Constructing
`x402ResourceServer` explicitly and awaiting `initialize()` fixed it immediately. Use
the explicit form.

**2. Base mainnet needs a paid facilitator.** The free public facilitator at
`https://x402.org/facilitator` is **testnet only**. Its `/supported` endpoint today
lists `eip155:84532` (Base Sepolia), Solana devnet, Hedera testnet, and friends —
there is no `eip155:8453`. For real money on Base you need Coinbase's CDP facilitator,
which is what `facilitator` from `@coinbase/x402` points at
(`https://api.cdp.coinbase.com/platform/v2/x402`). It reads `CDP_API_KEY_ID` and
`CDP_API_KEY_SECRET` from the environment, so you'll need a CDP account.

Mild irony worth flagging: you asked for no API keys, and there are none — for *your
callers*. You still need credentials with a facilitator to settle. If you want to avoid
that dependency you'd have to run your own facilitator, which means holding a funded
gas wallet and broadcasting transactions yourself. For a few-cents-per-call API, the
hosted facilitator is the right trade.

Develop against `eip155:84532` with the free facilitator, then flip the network
constant and swap in the CDP facilitator config for production.

**3. Networks are CAIP-2 now.** v2 uses `"eip155:8453"`, not the `"base"` /
`"base-sepolia"` strings you'll see in older docs and blog posts. The legacy names still
appear in the facilitator's supported list for back-compat, but write new code in
CAIP-2.

## What I verified

I installed everything into a scratch project and ran it, rather than going from docs:

- All packages above resolve and install cleanly today (0 vulnerabilities).
- `x402-axios@latest` fails to install — reproduced the `ETARGET` error.
- Both code samples above **typecheck** under `strict` with `moduleResolution: NodeNext`.
- Ran the server locally against the public facilitator on Base Sepolia. `GET /v1/answer`
  returns `402` with a `PAYMENT-REQUIRED` header that decodes to:

  ```json
  {"scheme":"exact","network":"eip155:84532","amount":"20000",
   "asset":"0x036CbD53842c5426634e7929541eC2318f3dCF7e",
   "payTo":"0x19E7...ff2A","maxTimeoutSeconds":300,
   "extra":{"name":"USDC","version":"2"}}
  ```

  `20000` is `$0.02` in USDC's 6 decimals — the price string is parsed correctly.

- Ran the real client against that server and traced the handshake:

  ```
  --> request #1  PAYMENT-SIGNATURE present: false
  <-- #1 status 402
  --> request #2  PAYMENT-SIGNATURE present: true
      payload: {"x402Version":2,"payload":{"authorization":{
        "from":"0x19E7...","to":"0x19E7...","value":"20000",
        "validAfter":"0","validBefore":"1789912739","nonce":"0xf6d5..."}}}
  <-- #2 status 402
  ```

  The client detected the 402, signed an EIP-3009 authorization for exactly 20000 units,
  and retried automatically — which is the behavior you're asking for. The second 402 is
  the facilitator correctly declining to settle, because I signed with a throwaway key
  holding no testnet USDC. Confirming a successful settlement needs a funded wallet,
  which I didn't have; that last hop is the one step here I haven't watched succeed.
