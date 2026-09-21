# Standard approach: x402 HTTP payments

Use **x402**. It is the current standard pattern for stateless, inline HTTP payments:

1. The agent calls your endpoint normally.
2. Your server returns `402 Payment Required` with price, recipient, network, and asset requirements.
3. The agent client signs a payment authorization, retries the same HTTP request with x402 payment headers, and your server lets it through.
4. A facilitator verifies and settles the payment on-chain.

For Base mainnet today, use network `eip155:8453` and native Base USDC:

```text
Base mainnet: eip155:8453
USDC:         0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
Scheme:       exact
```

Important: the default `https://x402.org/facilitator` endpoint currently advertises EVM `exact` support on Base Sepolia (`eip155:84532`), not Base mainnet. For the Base-mainnet example below, I verified `https://facilitator.openx402.ai/supported` advertises `exact` on `eip155:8453`.

## Install

```bash
npm install express dotenv viem @x402/core @x402/evm @x402/express @x402/fetch
npm install -D typescript @types/node @types/express
```

I verified these resolve from npm today in a clean temp project:

```text
@x402/core@2.26.0
@x402/evm@2.26.0
@x402/express@2.26.0
@x402/fetch@2.26.0
viem@2.56.8
express@5.2.1
dotenv@18.0.1
typescript@7.0.2
@types/node@26.6.2
@types/express@5.0.6
```

## Server: gate an Express endpoint

```ts
// server.ts
import "dotenv/config";
import express from "express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";

const app = express();

const payTo = process.env.PAY_TO_ADDRESS;
if (!payTo?.startsWith("0x")) {
  throw new Error("Set PAY_TO_ADDRESS to your Base receiving wallet");
}

const facilitator = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL ?? "https://facilitator.openx402.ai",
});

const resourceServer = new x402ResourceServer(facilitator).register(
  "eip155:8453",
  new ExactEvmScheme(),
);

app.use(
  paymentMiddleware(
    {
      "GET /v1/answer": {
        accepts: {
          scheme: "exact",
          network: "eip155:8453",
          price: "$0.03",
          payTo,
          maxTimeoutSeconds: 60,
        },
        description: "One paid AI-agent API call",
      },
    },
    resourceServer,
  ),
);

app.get("/v1/answer", (_req, res) => {
  res.json({
    ok: true,
    result: "This response was released after x402 payment verification.",
  });
});

app.listen(3000, () => {
  console.log("Paid API listening on http://localhost:3000");
});
```

`.env`:

```bash
PAY_TO_ADDRESS=0xYourReceivingWallet
X402_FACILITATOR_URL=https://facilitator.openx402.ai
```

## Client: pay and retry automatically

```ts
// client.ts
import "dotenv/config";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const privateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined;
if (!privateKey) {
  throw new Error("Set AGENT_PRIVATE_KEY to an EVM wallet holding Base USDC");
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
    maxAmountPerPayment: "$0.10",
  },
});

const response = await fetchWithPayment("http://localhost:3000/v1/answer");

if (!response.ok) {
  throw new Error(`Request failed: ${response.status} ${await response.text()}`);
}

console.log(await response.json());
console.log("Payment receipt:", response.headers.get("PAYMENT-RESPONSE"));
```

`.env`:

```bash
AGENT_PRIVATE_KEY=0xAgentWalletPrivateKey
```

## Notes

- The agent wallet needs Base USDC. With EIP-3009 USDC payments, the agent signs an authorization; the facilitator submits settlement, so the agent does not need a login, API key, invoice account, or a separate billing relationship with your server.
- Keep `spendControls` on the client. Agents should cap automatic payments.
- For POST requests, send a replayable body such as a JSON string. The x402 wrapper may need to retry the request after receiving the initial `402`.
- If you use a different facilitator, query its `/supported` endpoint first and confirm it advertises `{"scheme":"exact","network":"eip155:8453"}`.

Verification commands I ran:

```bash
npm --cache /tmp/npm-cache-x402 view @x402/fetch name version dist-tags.latest --json
npm --cache /tmp/npm-cache-x402 view @x402/express name version dist-tags.latest --json
npm --cache /tmp/npm-cache-x402 view @x402/evm name version dist-tags.latest --json
npm --cache /tmp/npm-cache-x402 view @x402/core name version dist-tags.latest --json
npm --cache /tmp/npm-cache-x402 install @x402/fetch @x402/express @x402/evm @x402/core viem express dotenv typescript @types/node @types/express
node --input-type=module -e "const r = await fetch('https://facilitator.openx402.ai/supported'); console.log(r.status, await r.text())"
```

Sources checked:

- https://www.npmjs.com/package/@x402/fetch
- https://www.npmjs.com/package/@x402/express
- https://facilitator.openx402.ai/supported
- https://x402.gitbook.io/x402/core-concepts/facilitator
