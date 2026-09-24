# Paid HTTP APIs for agents: use x402

The current standard fit for this is **x402**: the server answers an unpaid request with HTTP `402 Payment Required` plus payment requirements, and the agent client wraps `fetch`, signs/pays, and retries the same HTTP request automatically.

For Base mainnet, use x402 v2 network ID `eip155:8453`. Base Sepolia is `eip155:84532`.

## What to install

For one TypeScript repo containing both server and agent client:

```bash
npm install @x402/core@2.26.0 @x402/evm@2.26.0 @x402/express@2.26.0 @x402/fetch@2.26.0 @coinbase/x402@2.1.0 express@5.2.1 viem@2.56.8
npm install -D typescript@5.9.3 @types/node@26.6.2 @types/express@5.0.6
```

For server-only:

```bash
npm install @x402/core@2.26.0 @x402/evm@2.26.0 @x402/express@2.26.0 @coinbase/x402@2.1.0 express@5.2.1
```

For client-only:

```bash
npm install @x402/fetch@2.26.0 @x402/evm@2.26.0 viem@2.56.8
```

I confirmed these resolve today in this directory with `npm view`, installed them with `npm install`, and verified `npm ls --depth=0`. The installed versions are:

- `@x402/core@2.26.0`
- `@x402/evm@2.26.0`
- `@x402/express@2.26.0`
- `@x402/fetch@2.26.0`
- `@coinbase/x402@2.1.0`
- `express@5.2.1`
- `viem@2.56.8`
- `typescript@5.9.3`

Avoid the old unscoped packages (`x402`, `x402-fetch`, `x402-express`) for new work; they are the frozen v1 line.

## Server: gate an Express endpoint

This uses the maintained `@x402/express` middleware and Coinbase's hosted facilitator config. For verify/settle, set Coinbase CDP credentials:

```bash
export CDP_API_KEY_ID="..."
export CDP_API_KEY_SECRET="..."
export PAY_TO_ADDRESS="0xYourReceivingAddress"
```

```ts
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { facilitator } from "@coinbase/x402";

const app = express();
const payTo = process.env.PAY_TO_ADDRESS as `0x${string}`;

const facilitatorClient = new HTTPFacilitatorClient(facilitator);
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  "eip155:8453",
  new ExactEvmScheme(),
);

app.use(
  paymentMiddleware(
    {
      "POST /v1/infer": {
        accepts: {
          scheme: "exact",
          network: "eip155:8453",
          price: "$0.03",
          payTo,
          maxTimeoutSeconds: 60,
        },
        description: "One paid inference call",
      },
    },
    resourceServer,
  ),
);

app.post("/v1/infer", express.json(), async (req, res) => {
  res.json({
    result: "your paid API result",
  });
});

app.listen(3000, () => {
  console.log("paid API listening on http://localhost:3000");
});
```

## Client: pay and retry automatically

The client needs a funded wallet private key for the payment asset on Base, commonly USDC for dollar-string pricing where supported.

```bash
export AGENT_PRIVATE_KEY="0x..."
```

```ts
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`);

  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [
      {
        network: "eip155:8453",
        client: new ExactEvmScheme(account),
      },
    ],
  });

  const response = await fetchWithPayment("https://api.example.com/v1/infer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "price this call inline" }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const paymentResponse = response.headers.get("PAYMENT-RESPONSE");
  if (paymentResponse) {
    console.log("x402 settlement:", decodePaymentResponseHeader(paymentResponse));
  }

  console.log(await response.json());
}

void main();
```

## Verification done here

I verified the package names with `npm view`, installed the exact versions listed above, confirmed the dependency tree with `npm ls --depth=0`, and type-checked scratch copies of the server/client snippets with TypeScript using `--strict`, `--module NodeNext`, and `--moduleResolution NodeNext`. The type check passed.
