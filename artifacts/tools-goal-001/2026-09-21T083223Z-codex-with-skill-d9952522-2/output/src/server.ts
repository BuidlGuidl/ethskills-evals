import express from "express";
import { createFacilitatorConfig } from "@coinbase/x402";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { blockscoutBaseUrl, readServerEnv } from "./config.js";
import { summarizeWalletActivity } from "./activity.js";

const env = readServerEnv();
const app = express();
const explorerBaseUrl = blockscoutBaseUrl(env.PAYMENT_NETWORK, env.BLOCKSCOUT_BASE_URL);

const facilitatorConfig =
  env.CDP_API_KEY_ID && env.CDP_API_KEY_SECRET
    ? createFacilitatorConfig(env.CDP_API_KEY_ID, env.CDP_API_KEY_SECRET)
    : { url: env.FACILITATOR_URL };

const facilitatorClient = new HTTPFacilitatorClient(facilitatorConfig);

const resourceServer = new x402ResourceServer(facilitatorClient).register(
  env.PAYMENT_NETWORK,
  new ExactEvmScheme(),
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    paidEndpoint: "/api/wallet/:address/summary",
    price: env.PAYMENT_PRICE,
    network: env.PAYMENT_NETWORK,
    payTo: env.PAY_TO_ADDRESS,
  });
});

app.use(
  paymentMiddleware(
    {
      "GET /api/wallet/:address/summary": {
        accepts: {
          scheme: "exact",
          price: env.PAYMENT_PRICE,
          network: env.PAYMENT_NETWORK,
          payTo: env.PAY_TO_ADDRESS,
          maxTimeoutSeconds: 60,
        },
        description: "Short summary of a wallet's recent on-chain activity",
        mimeType: "application/json",
        serviceName: "Wallet Activity Summary API",
        unpaidResponseBody: () => ({
          contentType: "application/json",
          body: {
            error: "payment_required",
            accepts: "x402",
            price: env.PAYMENT_PRICE,
            network: env.PAYMENT_NETWORK,
          },
        }),
      },
    },
    resourceServer,
    undefined,
    undefined,
    true,
  ),
);

app.get("/api/wallet/:address/summary", async (req, res, next) => {
  try {
    const summary = await summarizeWalletActivity(req.params.address, explorerBaseUrl);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected error";
  res.status(message === "Invalid wallet address" ? 400 : 502).json({ error: message });
});

app.listen(env.PORT, () => {
  console.log(`Paid wallet summary API listening on http://localhost:${env.PORT}`);
  console.log(`Charging ${env.PAYMENT_PRICE} on ${env.PAYMENT_NETWORK}; funds settle to ${env.PAY_TO_ADDRESS}`);
  console.log(`Using facilitator ${facilitatorClient.url}`);
});
