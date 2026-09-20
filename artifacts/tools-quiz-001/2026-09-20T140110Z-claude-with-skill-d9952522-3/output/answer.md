# Pay-per-call HTTP APIs on Base with x402

## The standard answer

**x402** is the protocol for this. It reuses HTTP `402 Payment Required`: your
server answers an unpaid request with a 402 describing what it wants, the client
signs a payment authorization, retries with an `X-PAYMENT` header, and a
*facilitator* verifies and settles it on-chain. No accounts, no API keys, no
invoices — exactly the shape you described.

The payment itself is a signed EIP-3009 / Permit2 authorization over USDC, so the
agent never sends a transaction or pays gas; the facilitator broadcasts and
settles. That is what makes a two-cent call viable.

## What to install

```bash
# server
npm i express @x402/express @x402/core @x402/evm @coinbase/x402

# agent client
npm i viem @x402/evm @x402/fetch
```

Install the **scoped `@x402/*`** packages and keep every one of them on the same
major. Verified on npm today (2026-09-20):

| package | version |
|---|---|
| `@x402/core` | 2.26.0 |
| `@x402/evm` | 2.26.0 |
| `@x402/express` | 2.26.0 |
| `@x402/fetch` | 2.26.0 |
| `@coinbase/x402` | 2.1.0 |

**Do not use the unscoped `x402`, `x402-fetch`, or `x402-express`.** They resolve
fine — they are just frozen at `1.2.0` and are not the maintained line. If a
version range ever drags you back to them to settle a conflict, that is a bug to
fix, not a fallback to accept. `@coinbase/x402` is *not* an alternative to the
scoped family; it only supplies the Coinbase facilitator config and sits
alongside them.

Both files below were typechecked against these exact installed versions
(`tsc --strict`, `module: NodeNext`) — they compile with no errors.

## Server: gate the endpoint

```ts
import express from "express";
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { facilitator } from "@coinbase/x402";

const server = new x402ResourceServer(new HTTPFacilitatorClient(facilitator))
  .register("eip155:8453", new ExactEvmScheme());

const app = express();

app.use(paymentMiddleware({
  "GET /answer": {
    accepts: {
      scheme: "exact",
      network: "eip155:8453",
      payTo: process.env.PAY_TO_ADDRESS as `0x${string}`,
      price: "$0.02",
    },
    description: "One answer from the paid API",
  },
}, server));

app.get("/answer", (req, res) => res.json({ answer: 42 }));
app.listen(3000);
```

The middleware runs before your handler: unpaid requests get a 402 and never
reach it, and your route body only runs once payment is verified.

## Client: pay and retry automatically

```ts
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { toClientEvmSigner } from "@x402/evm";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: base, transport: http() });

const signer = toClientEvmSigner({
  address: account.address,
  signTypedData: (params) => account.signTypedData(params),
}, publicClient);

const client = new x402Client()
  .register("eip155:8453", new ExactEvmScheme(signer));

const fetchWithPay = wrapFetchWithPayment(fetch, client);

// One call. The 402, the signature, and the retry all happen inside.
const res = await fetchWithPay("https://api.example.com/answer?q=hi");
console.log(await res.json());

// Optional: the on-chain settlement receipt.
const receipt = res.headers.get("x-payment-response");
if (receipt) console.log(decodePaymentResponseHeader(receipt));
```

## API details worth getting right

These are the places where a remembered v1 snippet will not compile:

- **`wrapFetchWithPayment(fetch, client)` takes an `x402Client`, not a wallet or
  account.** Passing an account directly is the frozen v1 call shape. You build a
  client, `.register()` a scheme per network, and hand *that* over.
- **`x402Fetch` and `createWallet` do not exist** in the scoped packages. The
  installed exports of `@x402/fetch` are exactly `wrapFetchWithPayment`,
  `wrapFetchWithPaymentFromConfig`, `x402Client`, `x402HTTPClient`, and
  `decodePaymentResponseHeader`.
- **`ExactEvmScheme` is two different classes.** `@x402/evm/exact/server` takes
  no constructor argument; `@x402/evm/exact/client` takes the signer. Importing
  the wrong subpath is a confusing type error.
- **`facilitator` from `@coinbase/x402` is a config object, not a client.** Wrap
  it in `HTTPFacilitatorClient` before passing it to `x402ResourceServer`.
- **Networks are CAIP-2 strings.** Base mainnet is `"eip155:8453"`, Base Sepolia
  is `"eip155:84532"`. Not `"base"`.

## Before you go live

- Test on Base Sepolia (`eip155:84532`) first — same code, one string changed.
- The Coinbase facilitator needs CDP credentials for mainnet settlement; Base
  Sepolia works without them. Set them via the environment rather than in code.
- `price` accepts a money string like `"$0.02"`, resolved to USDC on the chosen
  network. You can also pass an explicit asset/amount if you want to pin the token.
- The agent's key funds real payments. Keep it in a dedicated low-balance wallet,
  and consider the client's spend controls to cap per-call and total spend.
