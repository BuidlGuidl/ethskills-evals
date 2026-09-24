import { HTTPFacilitatorClient } from "@x402/core/server";
import type { RoutesConfig } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import express, { type ErrorRequestHandler } from "express";
import { env, requireAddress } from "./config.js";
import { normalizeWalletAddress, summarizeWalletActivity } from "./activity.js";

const payTo = requireAddress(env.PAY_TO, "PAY_TO");
const paymentNetwork = env.X402_NETWORK as Network;

const app = express();

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    paidEndpoint: "/api/wallet-summary?address=0x...",
    network: env.X402_NETWORK,
    price: env.PAYMENT_PRICE,
    payTo,
  });
});

const facilitatorClient = new HTTPFacilitatorClient({ url: env.FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  paymentNetwork,
  new ExactEvmScheme(),
);

const paidRoutes = {
  "GET /api/wallet-summary": {
    accepts: {
      scheme: "exact",
      price: env.PAYMENT_PRICE,
      network: paymentNetwork,
      payTo,
      maxTimeoutSeconds: 120,
    },
    description: "Short summary of a wallet's recent Base activity",
    mimeType: "application/json",
    serviceName: "wallet-summary",
    tags: ["base", "wallet", "summary"],
    unpaidResponseBody: () => ({
      contentType: "application/json",
      body: {
        error: "payment_required",
        message: `Pay ${env.PAYMENT_PRICE} with x402 to access this wallet summary endpoint.`,
      },
    }),
  },
} satisfies RoutesConfig;

app.use(paymentMiddleware(paidRoutes, resourceServer));

app.get("/api/wallet-summary", async (req, res, next) => {
  try {
    const address = normalizeWalletAddress(req.query.address);
    const result = await summarizeWalletActivity(address);

    res.setHeader("cache-control", "no-store");
    res.json(result);
  } catch (error) {
    next(error);
  }
});

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const status = message.includes("valid EVM address") ? 400 : 502;

  res.status(status).json({
    error: status === 400 ? "bad_request" : "upstream_error",
    message,
  });
};

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Paid wallet activity API listening on http://localhost:${env.PORT}`);
  console.log(`Endpoint: GET /api/wallet-summary?address=0x...`);
  console.log(`x402 settlement: ${env.PAYMENT_PRICE} to ${payTo} on ${env.X402_NETWORK}`);
});
