# Standard: x402 v2 over HTTP 402

Use the x402 protocol. Your API returns `402 Payment Required` with machine-readable payment requirements. The agent signs a USDC payment authorization, retries the same HTTP request with the x402 payment header, and the resource server verifies/settles through a facilitator. On Base mainnet the network id is `eip155:8453`; for Base Sepolia use `eip155:84532`.

For the "no accounts, no API keys, no invoicing" version, point your server at a keyless facilitator such as OpenX402:

```txt
https://facilitator.openx402.ai
```

OpenX402's docs describe it as a permissionless x402 facilitator with no signup/login/API keys and Base support: https://docs.openx402.ai/

## Install

These are the packages I would install for a TypeScript Express API plus a TypeScript paying client:

```bash
npm install @x402/core@2.26.0 @x402/evm@2.26.0 @x402/express@2.26.0 @x402/fetch@2.26.0 express@5.2.1 viem@2.56.8
npm install -D typescript@5.9.3 tsx@4.23.15 @types/node@26.6.2 @types/express@5.0.6
```

I verified on September 21, 2026 that these resolve from npm and installed cleanly in this directory. `npm ls --depth=0` reports:

```txt
@x402/core@2.26.0
@x402/evm@2.26.0
@x402/express@2.26.0
@x402/fetch@2.26.0
express@5.2.1
viem@2.56.8
typescript@5.9.3
tsx@4.23.15
@types/node@26.6.2
@types/express@5.0.6
```

Do not use the old unscoped `x402`, `x402-fetch`, or `x402-express` packages for new TypeScript work; the maintained line is the scoped `@x402/*` family.

## Server: gate an Express endpoint

```ts
// server.ts
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient, type RoutesConfig } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

const NETWORK = "eip155:8453"; // Base mainnet. Use "eip155:84532" for Base Sepolia.
const PAY_TO = process.env.PAY_TO_ADDRESS as `0x${string}`;

if (!PAY_TO) {
  throw new Error("PAY_TO_ADDRESS is required");
}

const facilitator = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL ?? "https://facilitator.openx402.ai",
});

const resourceServer = new x402ResourceServer(facilitator).register(
  NETWORK,
  new ExactEvmScheme(),
);

const paidRoutes: RoutesConfig = {
  "POST /v1/answer": {
    accepts: {
      scheme: "exact",
      network: NETWORK,
      payTo: PAY_TO,
      price: "$0.03",
      maxTimeoutSeconds: 120,
    },
    description: "One AI answer",
    mimeType: "application/json",
  },
};

const app = express();
app.use(express.json());

// Must be registered before the protected route handler.
app.use(paymentMiddleware(paidRoutes, resourceServer));

app.post("/v1/answer", async (req, res) => {
  const prompt = String(req.body?.prompt ?? "");

  // Your paid API logic goes here.
  res.json({
    answer: `paid answer for: ${prompt}`,
  });
});

app.listen(3000, () => {
  console.log("paid API listening on http://localhost:3000");
});
```

Run it with:

```bash
PAY_TO_ADDRESS=0xYourReceivingWallet \
X402_FACILITATOR_URL=https://facilitator.openx402.ai \
npx tsx server.ts
```

## Client: pay and retry automatically

```ts
// client.ts
import {
  decodePaymentResponseHeader,
  wrapFetchWithPaymentFromConfig,
} from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const privateKey = process.env.EVM_PRIVATE_KEY as `0x${string}`;
const apiUrl = process.env.API_URL ?? "http://localhost:3000";

if (!privateKey) {
  throw new Error("EVM_PRIVATE_KEY is required");
}

const account = privateKeyToAccount(privateKey);

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: "eip155:8453",
      client: new ExactEvmScheme(account),
    },
  ],
});

async function main() {
  const response = await fetchWithPayment(`${apiUrl}/v1/answer`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "Summarize the x402 payment flow." }),
  });

  if (!response.ok) {
    throw new Error(`API failed: ${response.status} ${await response.text()}`);
  }

  const paymentReceipt = response.headers.get("PAYMENT-RESPONSE");
  if (paymentReceipt) {
    console.log("payment", decodePaymentResponseHeader(paymentReceipt));
  }

  console.log(await response.json());
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
```

Run it with a wallet that holds Base USDC:

```bash
EVM_PRIVATE_KEY=0xYourAgentWalletPrivateKey \
API_URL=http://localhost:3000 \
npx tsx client.ts
```

The first request receives `402 Payment Required`. `@x402/fetch` reads the `PAYMENT-REQUIRED` header, asks `@x402/evm` to sign the exact Base USDC payment, retries the request with the payment header, and exposes the settlement receipt in `PAYMENT-RESPONSE`.

## Notes

- Base mainnet USDC payments use the `exact` EVM scheme, typically EIP-3009 `transferWithAuthorization`, so the payer signs and the facilitator submits settlement on-chain.
- Your server does not need user accounts, API keys, invoices, or per-customer billing state for the happy path. Your receiving wallet is the `payTo` address.
- The agent wallet still needs enough USDC on the selected network.
- If you later choose Coinbase's facilitator, the helper package is `@coinbase/x402`, but that is facilitator configuration, not a replacement for `@x402/core`, `@x402/evm`, `@x402/express`, or `@x402/fetch`. For the no-account/no-key requirement above, I would use the keyless facilitator URL instead.

References checked:

- `@x402/express`: https://www.npmjs.com/package/@x402/express
- `@x402/fetch`: https://www.npmjs.com/package/@x402/fetch
- `@x402/evm`: https://www.npmjs.com/package/@x402/evm
- OpenX402 docs: https://docs.openx402.ai/
