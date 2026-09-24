import express, { type ErrorRequestHandler } from "express";
import { HTTPFacilitatorClient, type RoutesConfig } from "@x402/core/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { PAID_ROUTE, serverConfig } from "./config.js";
import { summarizeWalletActivity } from "./activity.js";

const app = express();
app.use(express.json());

const payTo = serverConfig.payTo();
const facilitator = new HTTPFacilitatorClient({ url: serverConfig.facilitatorUrl });
const resourceServer = new x402ResourceServer(facilitator).register(
  serverConfig.network,
  new ExactEvmScheme(),
);

const paidRoutes: RoutesConfig = {
  [PAID_ROUTE]: {
    accepts: {
      scheme: "exact",
      price: serverConfig.price,
      network: serverConfig.network,
      payTo,
      maxTimeoutSeconds: 120,
    },
    description: "Short summary of a wallet's recent Base on-chain activity",
    mimeType: "application/json",
    serviceName: "Wallet Activity Summary API",
    tags: ["wallet", "base", "activity", "summary"],
    unpaidResponseBody: () => ({
      contentType: "application/json",
      body: {
        error: "payment_required",
        message: "Retry this request with an x402 payment.",
        price: serverConfig.price,
        network: serverConfig.network,
        payTo,
      },
    }),
  },
};

app.use(paymentMiddleware(paidRoutes, resourceServer));

app.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    paidRoute: PAID_ROUTE,
    price: serverConfig.price,
    network: serverConfig.network,
    payTo,
  });
});

app.get("/v1/wallets/:address/activity-summary", async (req, res, next) => {
  try {
    const result = await summarizeWalletActivity({
      wallet: req.params.address,
      blockscoutBaseUrl: serverConfig.blockscoutBaseUrl,
      blockscoutApiKey: serverConfig.blockscoutApiKey,
      limit: Number(req.query.limit ?? 8),
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const status = message.includes("Blockscout returned") ? 502 : 400;
  res.status(status).json({ error: "request_failed", message });
};

app.use(errorHandler);

app.listen(serverConfig.port, () => {
  console.log(`x402 wallet activity API listening on http://localhost:${serverConfig.port}`);
  console.log(`paid route: ${PAID_ROUTE}`);
  console.log(`price: ${serverConfig.price} on ${serverConfig.network}`);
  console.log(`settlement recipient: ${payTo}`);
});
