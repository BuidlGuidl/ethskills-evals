# Paid agent API over HTTP: use x402

The standard way to do this today is **x402**: your API returns HTTP `402 Payment Required` with machine-readable payment requirements, and the agent client signs a payment authorization, retries the same HTTP request with payment headers, and then the facilitator verifies and settles on-chain.

For Base, use x402 v2 with CAIP-2 network IDs:

- Base mainnet: `eip155:8453`
- Base Sepolia for development: `eip155:84532`
- Typical asset: USDC via the EVM `exact` scheme, using EIP-3009 `transferWithAuthorization`

You do not need accounts, API keys, or invoices. The server protects the route; the client pays inline when it sees `402`.

## Install

For an Express server plus a TypeScript agent client:

```bash
npm install express @x402/express @x402/core @x402/evm @x402/fetch viem
npm install -D typescript tsx @types/node
```

If you use Express 4 instead of current Express 5, also install:

```bash
npm install -D @types/express
```

I verified these package names resolve from npm today, 2026-09-21:

```text
@x402/core    2.26.0
@x402/evm     2.26.0
@x402/fetch   2.26.0
@x402/express 2.26.0
express       5.2.1
viem          2.56.8
typescript    7.0.2
tsx           4.23.15
```

I also ran a clean temp install:

```bash
npm --cache /tmp/npm-cache install --package-lock-only --ignore-scripts \
  express @x402/express @x402/core @x402/evm @x402/fetch viem
```

It resolved successfully and audited with `0 vulnerabilities`. I then did a full temp install and `npx tsc --noEmit` against the snippets below; the imports and types checked.

## Server: gate the endpoint

This charges `$0.03` USDC on Base mainnet before allowing `POST /v1/agent-call` through.

```ts
// server.ts
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

const app = express();
app.use(express.json());

const facilitator = new HTTPFacilitatorClient({
  url: "https://x402.org/facilitator",
});

const resourceServer = new x402ResourceServer(facilitator);
registerExactEvmScheme(resourceServer, { networks: ["eip155:8453"] });

app.use(
  paymentMiddleware(
    {
      "POST /v1/agent-call": {
        accepts: {
          scheme: "exact",
          network: "eip155:8453",
          price: "$0.03",
          payTo: process.env.PAY_TO_ADDRESS as `0x${string}`,
          maxTimeoutSeconds: 60,
        },
        description: "Paid AI agent API call",
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

Use `eip155:84532` while testing on Base Sepolia, then switch to `eip155:8453` for production.

## Client: pay and retry automatically

The agent needs a funded wallet private key with USDC on the chosen network. It does not send a transaction itself; it signs the payment authorization and `@x402/fetch` retries the HTTP request with the payment header.

```ts
// client.ts
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`);

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: "eip155:8453",
      client: new ExactEvmScheme(account),
    },
  ],
});

async function main() {
  const response = await fetchWithPayment("https://api.example.com/v1/agent-call", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "quote shipping to NYC" }),
  });

  if (!response.ok) {
    throw new Error(`API failed: ${response.status} ${await response.text()}`);
  }

  console.log(await response.json());
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
```

## What happens on the wire

1. Agent calls your endpoint normally.
2. Your middleware returns `402 Payment Required` with price, network, asset, `payTo`, and scheme.
3. The wrapped fetch client signs an EIP-3009 authorization for the requested USDC amount.
4. The client retries the same request with x402 payment headers.
5. Your server asks the facilitator to verify and settle.
6. USDC settles on-chain to `PAY_TO_ADDRESS`, and your handler returns the API response.

Sources checked: x402 Foundation SDK/docs at https://github.com/x402-foundation/x402, npm package metadata for `@x402/*`, and OpenX402 docs at https://docs.openx402.ai/.
