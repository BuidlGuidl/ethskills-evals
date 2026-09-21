# Paid HTTP APIs for AI agents: use x402

The standard way to do this today is **x402**: your API returns HTTP `402 Payment Required` with machine-readable payment requirements, and the agent retries the same HTTP request with a signed payment payload. On Base, the normal rail is the `exact` scheme using USDC-style EIP-3009 authorization: the agent signs, the facilitator verifies/settles on-chain, and your route handler only runs after payment is accepted.

Use Base mainnet as CAIP-2 network `eip155:8453`. Use Base Sepolia for development as `eip155:84532`.

Sources:

- x402 Foundation repo: https://github.com/x402-foundation/x402
- `@x402/fetch` npm package: https://www.npmjs.com/package/@x402/fetch
- `@x402/express` npm package: https://www.npmjs.com/package/@x402/express

## Install

For one TypeScript repo containing both the paid Express API and the agent client:

```bash
npm pkg set type=module
npm install express @x402/core @x402/express @x402/fetch @x402/evm viem dotenv
npm install -D typescript tsx @types/node @types/express
```

If you split server and client:

```bash
# Server
npm install express @x402/core @x402/express @x402/evm dotenv
npm install -D typescript tsx @types/node @types/express

# Agent client
npm install @x402/fetch @x402/evm viem dotenv
npm install -D typescript tsx @types/node
```

I verified resolution on 2026-09-20 with npm. The installed versions were:

```text
@x402/core@2.26.0
@x402/evm@2.26.0
@x402/express@2.26.0
@x402/fetch@2.26.0
dotenv@18.0.1
express@5.2.1
viem@2.56.8
tsx@4.23.15
typescript@7.0.2
@types/express@5.0.6
@types/node@26.6.2
```

The install completed with `found 0 vulnerabilities`, and the server/client snippets below passed `npx tsc --noEmit` in a scratch project.

## Server

Environment:

```bash
PAY_TO_ADDRESS=0xYourReceivingWallet
X402_FACILITATOR_URL=https://x402.org/facilitator
PORT=3000
```

`server.ts`:

```ts
import "dotenv/config";
import express from "express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";

const payTo = process.env.PAY_TO_ADDRESS as `0x${string}`;

if (!payTo) {
  throw new Error("PAY_TO_ADDRESS is required");
}

const facilitator = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator",
});

const resourceServer = new x402ResourceServer(facilitator).register(
  "eip155:8453",
  new ExactEvmScheme(),
);

const app = express();
app.use(express.json());

app.use(
  paymentMiddleware(
    {
      "POST /v1/agent-call": {
        accepts: {
          scheme: "exact",
          price: "$0.03",
          network: "eip155:8453",
          payTo,
          maxTimeoutSeconds: 60,
        },
        description: "One paid AI-agent API call",
      },
    },
    resourceServer,
  ),
);

app.post("/v1/agent-call", async (req, res) => {
  res.json({
    ok: true,
    input: req.body,
    result: "paid response",
  });
});

app.listen(Number(process.env.PORT ?? 3000));
```

Run it:

```bash
npx tsx server.ts
```

## Agent Client

Environment:

```bash
AGENT_PRIVATE_KEY=0xAgentWalletPrivateKey
API_URL=http://localhost:3000/v1/agent-call
```

The agent wallet must hold enough USDC on Base for the payment.

`client.ts`:

```ts
import "dotenv/config";
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const privateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}`;
const apiUrl = process.env.API_URL ?? "http://localhost:3000/v1/agent-call";

if (!privateKey) {
  throw new Error("AGENT_PRIVATE_KEY is required");
}

const account = privateKeyToAccount(privateKey);

const paidFetch = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: "eip155:8453",
      client: new ExactEvmScheme(account),
    },
  ],
});

const response = await paidFetch(apiUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ prompt: "summarize this" }),
});

if (!response.ok) {
  throw new Error(`API call failed: ${response.status} ${await response.text()}`);
}

const paymentResponse = response.headers.get("PAYMENT-RESPONSE");

console.log({
  payment: paymentResponse ? decodePaymentResponseHeader(paymentResponse) : undefined,
  data: await response.json(),
});
```

Run it:

```bash
npx tsx client.ts
```

## Production notes

Use `eip155:84532` and a test facilitator while developing, then switch to `eip155:8453` for Base mainnet. Keep your receiving wallet address server-side, keep the agent private key client-side only, and set client spend controls if the agent might call arbitrary x402 endpoints. The default `@x402/fetch` client has built-in payment handling; your app code just calls `paidFetch(...)` and receives the final paid response.
