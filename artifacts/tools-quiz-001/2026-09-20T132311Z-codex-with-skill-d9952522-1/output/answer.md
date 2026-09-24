# Standard: x402 over HTTP 402

Use the x402 payment protocol. Your API returns `402 Payment Required` with machine-readable payment requirements; the agent client signs an EVM payment authorization, retries the same HTTP request with the payment header, and your server verifies/settles on-chain through a facilitator. No accounts, API keys, or invoices are needed between your API and the agent. Base mainnet is `eip155:8453`; with x402's default EVM asset table, a price like `"$0.02"` on Base resolves to USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.

Install the maintained scoped packages, not the old unscoped `x402`, `x402-fetch`, or `x402-express` line:

```bash
npm pkg set type=module
npm install @x402/core @x402/evm @x402/express @x402/fetch @coinbase/x402 express viem dotenv
npm install -D typescript @types/node @types/express
```

I verified today that these resolve and typecheck together:

```text
@x402/core     2.26.0
@x402/evm      2.26.0
@x402/express  2.26.0
@x402/fetch    2.26.0
@coinbase/x402 2.1.0
```

Verification command run in a clean temp project:

```bash
npm install @x402/core@2.26.0 @x402/evm@2.26.0 @x402/express@2.26.0 @x402/fetch@2.26.0 @coinbase/x402@2.1.0 express viem dotenv typescript @types/node @types/express
npx tsc --noEmit
```

## Server: gate an Express endpoint

```ts
// server.ts
import "dotenv/config";
import express from "express";
import { createFacilitatorConfig } from "@coinbase/x402";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { HTTPFacilitatorClient, type RoutesConfig } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

const app = express();

const BASE = "eip155:8453" as const;
const payTo = process.env.RECEIVING_ADDRESS as `0x${string}`;

if (!payTo) {
  throw new Error("Set RECEIVING_ADDRESS to your Base recipient wallet");
}

const routes: RoutesConfig = {
  "/v1/complete": {
    accepts: {
      scheme: "exact",
      network: BASE,
      payTo,
      price: "$0.02",
      maxTimeoutSeconds: 120
    },
    description: "Paid model completion",
    mimeType: "application/json"
  }
};

const facilitator = new HTTPFacilitatorClient(
  createFacilitatorConfig(
    process.env.CDP_API_KEY_ID,
    process.env.CDP_API_KEY_SECRET
  )
);

app.use(
  paymentMiddlewareFromConfig(
    routes,
    facilitator,
    [{ network: BASE, server: new ExactEvmScheme() }]
  )
);

app.get("/v1/complete", (_req, res) => {
  res.json({ completion: "This response was released after x402 payment." });
});

app.listen(3000, () => {
  console.log("paid API listening on http://localhost:3000");
});
```

Server env:

```bash
RECEIVING_ADDRESS=0xYourBaseRecipient
CDP_API_KEY_ID=optional_or_required_by_your_facilitator
CDP_API_KEY_SECRET=optional_or_required_by_your_facilitator
```

## Agent client: pay and retry automatically

```ts
// client.ts
import "dotenv/config";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const privateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}`;

if (!privateKey) {
  throw new Error("Set AGENT_PRIVATE_KEY to the paying wallet private key");
}

const account = privateKeyToAccount(privateKey);
const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL)
});

const client = new x402Client().setSpendControls({
  maxAmountPerPayment: "$0.05"
});

registerExactEvmScheme(client, {
  signer: toClientEvmSigner(account, publicClient),
  networks: ["eip155:8453"],
  schemeOptions: {
    8453: { rpcUrl: process.env.BASE_RPC_URL }
  }
});

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

const response = await fetchWithPayment("http://localhost:3000/v1/complete");

if (!response.ok) {
  throw new Error(`Request failed: ${response.status} ${await response.text()}`);
}

console.log(await response.json());
```

Client env:

```bash
AGENT_PRIVATE_KEY=0x...
BASE_RPC_URL=https://your-base-rpc.example
```

The paying wallet needs enough Base USDC for the per-call price and enough ETH for any approval/setup gas that its chosen payment flow requires. The x402 client handles the `402`, payment payload creation, and retry; your application code just calls `fetchWithPayment`.
