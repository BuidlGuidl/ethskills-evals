import express from "express";
import { HTTPFacilitatorClient, type RoutesConfig } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { isAddress } from "viem";
import { z } from "zod";
import { summarizeWalletActivity } from "./activity.js";
import { getServerEnv } from "./config.js";

const env = getServerEnv();
const network = env.NETWORK as Network;
const app = express();

const paidSummaryPath = "GET /v1/wallet/:address/summary";
const facilitatorClient = new HTTPFacilitatorClient({ url: env.FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  network,
  new ExactEvmScheme(),
);

const routes: RoutesConfig = {
  [paidSummaryPath]: {
    accepts: {
      scheme: "exact",
      price: env.PRICE,
      network,
      payTo: env.PAY_TO_ADDRESS,
      maxTimeoutSeconds: env.MAX_TIMEOUT_SECONDS,
    },
    description: "Short summary of a wallet's recent Base activity",
    mimeType: "application/json",
    serviceName: "Paid Wallet Summary API",
    unpaidResponseBody: () => ({
      contentType: "application/json",
      body: {
        error: "payment_required",
        message: `Pay ${env.PRICE} over x402 to call this endpoint.`,
      },
    }),
  },
};

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    paidRoute: "/v1/wallet/:address/summary",
    price: env.PRICE,
    network: env.NETWORK,
    payTo: env.PAY_TO_ADDRESS,
    facilitator: env.FACILITATOR_URL,
  });
});

app.use(paymentMiddleware(routes, resourceServer));

app.get("/v1/wallet/:address/summary", async (req, res, next) => {
  try {
    const address = req.params.address;
    if (!address || !isAddress(address)) {
      res.status(400).json({ error: "invalid_address" });
      return;
    }

    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(20).default(8),
      })
      .parse(req.query);

    const activity = await summarizeWalletActivity({
      address,
      blockscoutBaseUrl: env.BLOCKSCOUT_BASE_URL,
      limit: query.limit,
    });

    res.json(activity);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected error";
  console.error(error);
  res.status(500).json({ error: "server_error", message });
});

app.listen(env.PORT, () => {
  console.log(`Paid wallet summary API listening on http://localhost:${env.PORT}`);
  console.log(`Paid route: GET /v1/wallet/:address/summary (${env.PRICE} on ${env.NETWORK})`);
  console.log(`Facilitator: ${env.FACILITATOR_URL}`);
});
