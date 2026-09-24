import express from "express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { RoutesConfig } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";

import {
  getFacilitatorConfig,
  getNetworkName,
  getPaymentNetwork,
  normalizeEnvAddress,
  optionalEnv,
} from "./config.js";
import { summarizeWalletActivity } from "./activity.js";

const app = express();
app.use(express.json());

const port = Number(optionalEnv("PORT") ?? 3000);
const payTo = normalizeEnvAddress("PAY_TO_ADDRESS");
const network = getPaymentNetwork();
const price = optionalEnv("PRICE_USD") ?? "$0.02";

const facilitatorClient = new HTTPFacilitatorClient(getFacilitatorConfig());
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  network,
  new ExactEvmScheme(),
);

const routes: RoutesConfig = {
  "GET /v1/wallets/:address/activity-summary": {
    accepts: {
      scheme: "exact",
      price,
      network: network as Network,
      payTo,
      maxTimeoutSeconds: 120,
    },
    description: `Short recent on-chain activity summary for one wallet on ${getNetworkName(network)}`,
    mimeType: "application/json",
    serviceName: "Paid Wallet Activity API",
    tags: ["wallet", "base", "agent", "summary"],
    unpaidResponseBody: () => ({
      contentType: "application/json",
      body: {
        error: "payment_required",
        message: "Pay with x402 to receive this wallet activity summary.",
        price,
        network,
        payTo,
      },
    }),
  },
};

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "paid-wallet-activity-api",
    paidEndpoint: "/v1/wallets/:address/activity-summary",
    price,
    network,
    settlement: {
      token: "USDC",
      chain: getNetworkName(network),
      payTo,
    },
  });
});

app.use(paymentMiddleware(routes, resourceServer));

app.get("/v1/wallets/:address/activity-summary", async (req, res, next) => {
  try {
    const summary = await summarizeWalletActivity(req.params.address);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  const status = message.includes("valid EVM address") ? 400 : 500;
  res.status(status).json({ error: status === 400 ? "bad_request" : "internal_error", message });
});

app.listen(port, () => {
  console.log(`Paid wallet activity API listening on http://localhost:${port}`);
  console.log(`Charging ${price} on ${network} (${getNetworkName(network)}) to ${payTo}`);
});
