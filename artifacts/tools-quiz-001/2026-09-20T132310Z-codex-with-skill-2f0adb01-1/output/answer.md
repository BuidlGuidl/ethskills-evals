# Paid per-call agent API: use x402

The standard way to do this today is **x402**: your resource server returns HTTP `402 Payment Required` with machine-readable payment requirements, and the agent client signs a payment payload and retries the same HTTP request automatically. For Base, use the EVM **exact** scheme on `eip155:8453` with USDC. For testing, swap the network to Base Sepolia, `eip155:84532`.

In the current TypeScript SDK, let the packages handle the wire headers for you. In v2, the flow is `PAYMENT-REQUIRED` challenge, signed `PAYMENT-SIGNATURE` retry, and `PAYMENT-RESPONSE` settlement confirmation. You do not need API keys, app accounts, or invoices for the API itself. The client wallet is the payer identity.

## Install

For a single TypeScript repo containing both server and client:

```bash
npm pkg set type=module
npm install @x402/core @x402/evm @x402/express @x402/fetch viem express dotenv
npm install -D typescript tsx @types/express
```

Server-only:

```bash
npm install @x402/core @x402/evm @x402/express express dotenv
npm install -D typescript tsx @types/express
```

Client-only:

```bash
npm install @x402/core @x402/evm @x402/fetch viem dotenv
npm install -D typescript tsx
```

## Server: Express endpoint gated by payment

`PAY_TO` is your receiving wallet address. The server does not need the customer's wallet, an API key database, or a private key just to receive payments through the hosted facilitator.

```ts
// server.ts
import "dotenv/config";
import express from "express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";

const payTo = process.env.PAY_TO as `0x${string}`;
if (!payTo) {
  throw new Error("Set PAY_TO to the wallet address that should receive USDC.");
}

const app = express();
app.use(express.json());

const facilitator = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator",
});

const resourceServer = new x402ResourceServer(facilitator).register(
  "eip155:8453", // Base mainnet. Use "eip155:84532" for Base Sepolia.
  new ExactEvmScheme(),
);

app.use(
  paymentMiddleware(
    {
      "POST /v1/agent-call": {
        accepts: {
          scheme: "exact",
          network: "eip155:8453",
          payTo,
          price: "$0.03",
        },
        description: "Run one paid agent API call",
        mimeType: "application/json",
      },
    },
    resourceServer,
  ),
);

app.post("/v1/agent-call", (req, res) => {
  res.json({
    ok: true,
    result: `processed ${JSON.stringify(req.body)}`,
  });
});

app.listen(3000, () => {
  console.log("paid API listening on http://localhost:3000");
});
```

Run it:

```bash
PAY_TO=0xYourReceivingAddress npm exec tsx server.ts
```

## Agent client: pay and retry automatically

The agent wallet needs USDC on Base. With USDC/EIP-3009, the client signs locally; it does not need ETH for gas for the payment transfer. Set `TRUSTED_PAY_TO` to your server's receiving address so the agent refuses to pay a spoofed endpoint.

```ts
// client.ts
import "dotenv/config";
import {
  decodePaymentResponseHeader,
  wrapFetchWithPaymentFromConfig,
} from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const privateKey = process.env.EVM_PRIVATE_KEY as `0x${string}`;
if (!privateKey) {
  throw new Error("Set EVM_PRIVATE_KEY to an agent wallet funded with USDC on Base.");
}

const account = privateKeyToAccount(privateKey);

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: "eip155:8453",
      client: new ExactEvmScheme(account),
    },
  ],
  spendControls: {
    maxAmountPerPayment: "$0.05",
  },
  policies: [
    (_version, accepts) =>
      accepts.filter(
        accept =>
          accept.network === "eip155:8453" &&
          accept.scheme === "exact" &&
          accept.payTo.toLowerCase() ===
            (process.env.TRUSTED_PAY_TO ?? "").toLowerCase(),
      ),
  ],
});

const response = await fetchWithPayment(
  process.env.API_URL ?? "http://localhost:3000/v1/agent-call",
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "hello from an agent" }),
  },
);

if (!response.ok) {
  throw new Error(`API failed: ${response.status} ${await response.text()}`);
}

const paymentResponse = response.headers.get("PAYMENT-RESPONSE");
if (paymentResponse) {
  console.log("settlement", decodePaymentResponseHeader(paymentResponse));
}

console.log(await response.json());
```

Run it:

```bash
EVM_PRIVATE_KEY=0xAgentPrivateKey \
TRUSTED_PAY_TO=0xYourReceivingAddress \
API_URL=http://localhost:3000/v1/agent-call \
npm exec tsx client.ts
```

## What happens on each call

1. Agent calls `POST /v1/agent-call`.
2. Server middleware returns `402 Payment Required` with price, network, scheme, and payee.
3. `@x402/fetch` signs a payment payload using the agent's wallet.
4. The wrapper retries the same request with the payment signature.
5. The resource server verifies and settles through the facilitator.
6. Your handler returns JSON, and the response includes settlement confirmation in `PAYMENT-RESPONSE`.

## Verification performed today

I verified the install in a throwaway project at `/tmp/x402-install-check.HvbEEY` on 2026-09-20:

```text
@x402/core@2.26.0
@x402/evm@2.26.0
@x402/express@2.26.0
@x402/fetch@2.26.0
viem@2.56.8
express@5.2.1
dotenv@18.0.1
tsx@4.23.15
typescript@7.0.2
@types/express@5.0.6
```

The exact install command resolved successfully with npm, added 116 packages, and reported 0 vulnerabilities. I also compiled the server and client snippets above with `npx tsc --noEmit`; compilation passed.

## References checked

- x402 Foundation TypeScript SDK and package list: https://github.com/x402-foundation/x402/tree/main/typescript
- x402 protocol README and flow: https://github.com/coinbase/x402
- `@x402/express` README installed from npm package `2.26.0`
- `@x402/fetch` README installed from npm package `2.26.0`
- `@x402/evm` README installed from npm package `2.26.0`
