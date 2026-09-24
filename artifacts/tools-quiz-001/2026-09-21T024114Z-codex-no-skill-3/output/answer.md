# Paid API Calls For Agents: Use x402

The current standard fit is **x402 V2**: your API returns `402 Payment Required` with machine-readable payment requirements, the agent signs a payment authorization, retries the same HTTP request with the payment header, and your server verifies/settles through an x402 facilitator. For Base, use USDC on CAIP-2 network `eip155:8453` (`eip155:84532` for Base Sepolia testing).

This gives buyers no account, no API key, and no invoice. They only need a funded wallet. Your server still needs a facilitator URL that supports the network/scheme you advertise; the facilitator is what verifies and submits settlement on-chain. Use a production facilitator provider for mainnet, or run your own.

## Install

Server:

```bash
npm install express @x402/core @x402/express @x402/evm
npm install --save-dev typescript tsx @types/express @types/node
```

Agent/client:

```bash
npm install @x402/fetch @x402/evm viem
npm install --save-dev typescript tsx @types/node
```

As of 2026-09-21, I confirmed these resolve from npm:

```text
@x402/core@2.26.0
@x402/express@2.26.0
@x402/fetch@2.26.0
@x402/evm@2.26.0
viem@2.56.8
express@5.2.1
typescript@5.9.2
tsx@4.23.15
@types/express@5.0.6
@types/node@24.6.2
```

I also verified the imports used below resolve from the installed packages.

## Server: Express Resource Server

```ts
// server.ts
import express from "express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";

const app = express();
app.use(express.json());

const NETWORK = "eip155:8453"; // Base mainnet. Use "eip155:84532" for Base Sepolia.
const PRICE = "$0.03";

const payTo = process.env.X402_PAY_TO_ADDRESS;
const facilitatorUrl = process.env.X402_FACILITATOR_URL;

if (!payTo) throw new Error("Set X402_PAY_TO_ADDRESS to your Base receiving address");
if (!facilitatorUrl) throw new Error("Set X402_FACILITATOR_URL to your facilitator URL");

const facilitator = new HTTPFacilitatorClient({ url: facilitatorUrl });
const resourceServer = new x402ResourceServer(facilitator).register(
  NETWORK,
  new ExactEvmScheme(),
);

app.use(
  paymentMiddleware(
    {
      "POST /v1/run": {
        accepts: {
          scheme: "exact",
          network: NETWORK,
          price: PRICE,
          payTo,
          maxTimeoutSeconds: 300,
        },
        description: "Paid AI agent API call",
      },
    },
    resourceServer,
  ),
);

app.post("/v1/run", async (req, res) => {
  res.json({
    ok: true,
    input: req.body,
    result: "This response was released after x402 payment verification.",
  });
});

app.listen(3000, () => {
  console.log("Paid API listening on http://localhost:3000");
});
```

Run it:

```bash
X402_PAY_TO_ADDRESS=0xYourReceivingWallet \
X402_FACILITATOR_URL=https://your-facilitator.example \
npx tsx server.ts
```

## Client: Agent Fetch That Pays And Retries

```ts
// client.ts
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const privateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined;
if (!privateKey) throw new Error("Set AGENT_PRIVATE_KEY");

const account = privateKeyToAccount(privateKey);

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: "eip155:8453", // Base mainnet
      client: new ExactEvmScheme(account),
    },
  ],
});

const response = await fetchWithPayment("https://api.example.com/v1/run", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ prompt: "Do the paid thing" }),
});

if (!response.ok) {
  throw new Error(`API failed: ${response.status} ${await response.text()}`);
}

const paymentResponse = response.headers.get("PAYMENT-RESPONSE");
if (paymentResponse) {
  console.log("payment", decodePaymentResponseHeader(paymentResponse));
}

console.log(await response.json());
```

Run it:

```bash
AGENT_PRIVATE_KEY=0xAgentWalletPrivateKey npx tsx client.ts
```

The agent wallet must hold enough USDC on Base. With the EVM `exact` scheme, Base USDC uses EIP-3009 `transferWithAuthorization`, so the agent signs a typed authorization and the facilitator handles on-chain submission.

## Sources Checked

- x402 Foundation SDK repo and protocol flow: https://github.com/x402-foundation/x402
- `@x402/express` package docs: https://www.npmjs.com/package/@x402/express
- `@x402/fetch` package docs: https://www.npmjs.com/package/@x402/fetch
- x402 overview and V2 notes: https://www.x402.org/
