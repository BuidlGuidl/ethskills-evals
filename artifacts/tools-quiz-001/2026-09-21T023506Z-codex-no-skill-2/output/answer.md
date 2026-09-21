# Paid agent API over HTTP: use x402

The standard way to do this today is **x402 v2**: your API returns `402 Payment Required` with machine-readable payment requirements, and the agent client signs an on-chain payment authorization and retries the same HTTP request with a payment header. For Base, use the EVM `exact` scheme with USDC on Base mainnet (`eip155:8453`). The client signs a USDC authorization, and a facilitator verifies and settles it on-chain.

Sources:

- x402 docs: https://docs.x402.org/introduction
- x402 seller quickstart: https://docs.x402.org/getting-started/quickstart-for-sellers.md
- x402 buyer quickstart: https://docs.x402.org/getting-started/quickstart-for-buyers.md
- networks and Base USDC defaults: https://docs.x402.org/core-concepts/network-and-token-support.md
- facilitator options: https://docs.x402.org/dev-tools/facilitators.md
- TypeScript SDK repo/packages: https://github.com/x402-foundation/x402

## What to install

For one TypeScript project containing both the Express server and the agent client:

```bash
npm install express @x402/express @x402/core @x402/evm @x402/fetch viem
npm install -D typescript tsx @types/node @types/express
```

If split into separate projects:

```bash
# Server
npm install express @x402/express @x402/core @x402/evm
npm install -D typescript tsx @types/node @types/express

# Client/agent
npm install @x402/fetch @x402/evm viem
npm install -D typescript tsx @types/node
```

I verified resolution with a fresh npm install on 2026-09-21. Installed versions were:

```text
@x402/core@2.26.0
@x402/evm@2.26.0
@x402/express@2.26.0
@x402/fetch@2.26.0
express@5.2.1
viem@2.56.8
typescript@7.0.2
tsx@4.23.15
@types/node@26.6.2
@types/express@5.0.6
```

I also smoke-tested the imports and type-checked the server/client snippets below with:

```bash
npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck --strict server.ts client.ts
```

## Server: gate an endpoint behind payment

This example charges `$0.03` USDC per `POST /v1/infer` call on Base mainnet. `PAY_TO_ADDRESS` is your receiving EVM address. The facilitator URL below is a production no-key option listed in the x402 facilitator directory. For Base Sepolia testing, use `network: "eip155:84532"` and `https://x402.org/facilitator`; do not use the public `x402.org` facilitator for mainnet.

```typescript
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

const app = express();
app.use(express.json());

const payTo = process.env.PAY_TO_ADDRESS as `0x${string}`;
if (!payTo) {
  throw new Error("Set PAY_TO_ADDRESS to your Base/EVM receiving wallet");
}

const facilitator = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL ?? "https://facilitator.payai.network",
});

const resourceServer = new x402ResourceServer(facilitator).register(
  "eip155:8453",
  new ExactEvmScheme(),
);

app.use(
  paymentMiddleware(
    {
      "POST /v1/infer": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.03",
            network: "eip155:8453",
            payTo,
            maxTimeoutSeconds: 60,
          },
        ],
        description: "One AI inference call",
        mimeType: "application/json",
      },
    },
    resourceServer,
  ),
);

app.post("/v1/infer", async (req, res) => {
  const prompt = String(req.body?.prompt ?? "");

  // Do your paid work only after x402 middleware verifies payment.
  res.json({ result: `processed: ${prompt}` });
});

app.listen(3000, () => {
  console.log("paid API listening on http://localhost:3000");
});
```

## Client: pay and retry automatically

The agent wallet needs USDC on Base. With USDC/EIP-3009, the agent signs an authorization; the facilitator submits settlement, so the client does not need your API account, API key, invoice flow, or a separate checkout session.

```typescript
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);

const client = new x402Client().register("eip155:8453", new ExactEvmScheme(account));
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

async function main() {
  const response = await fetchWithPayment("https://api.example.com/v1/infer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "price this call inline" }),
  });

  if (!response.ok) {
    throw new Error(`paid call failed: ${response.status} ${await response.text()}`);
  }

  console.log(await response.json());
  console.log("payment response:", response.headers.get("PAYMENT-RESPONSE"));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
```

## Operational notes

- Use `exact` for fixed price per call, as above. Use `upto` or `batch-settlement` only if you need variable usage pricing or high-frequency micropayments.
- Base mainnet is `eip155:8453`; Base Sepolia is `eip155:84532`.
- Dollar string pricing like `"$0.03"` maps to the default stablecoin for that chain. For Base mainnet, that is USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, 6 decimals, using EIP-3009.
- Choose your facilitator deliberately for production. The public `https://x402.org/facilitator` endpoint is for testnet/quickstarts. Production choices listed by x402 include CDP, PayAI, Dexter, Mogami, Corbits, Solvador, and others.
