import express from "express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { config, paidRoute } from "./config.js";
import { summarizeWalletActivity } from "./activity.js";

const app = express();

const facilitatorClient = new HTTPFacilitatorClient({
  url: config.X402_FACILITATOR_URL,
});

const resourceServer = new x402ResourceServer(facilitatorClient).register(
  config.X402_NETWORK,
  new ExactEvmScheme(),
);

app.use(
  paymentMiddleware(
    {
      [`GET ${paidRoute}`]: {
        accepts: {
          scheme: "exact",
          price: config.X402_PRICE,
          network: config.X402_NETWORK,
          payTo: config.PAY_TO,
          maxTimeoutSeconds: 300,
        },
        description: "Short summary of a wallet's recent on-chain activity",
        mimeType: "application/json",
      },
    },
    resourceServer,
  ),
);

app.get("/", (_req, res) => {
  res.json({
    service: "paid-wallet-activity-api",
    route: paidRoute,
    price: config.X402_PRICE,
    network: config.X402_NETWORK,
    payTo: config.PAY_TO,
  });
});

app.get(paidRoute, async (req, res, next) => {
  try {
    const wallet = String(req.query.wallet ?? "");
    const result = await summarizeWalletActivity(wallet);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const message = error instanceof Error ? error.message : "unknown error";
    const status = message.includes("valid EVM address") ? 400 : 502;
    res.status(status).json({ error: message });
  },
);

app.listen(config.PORT, () => {
  console.log(
    `Paid wallet activity API listening on http://localhost:${config.PORT}`,
  );
  console.log(
    `Payments: ${config.X402_PRICE} USDC on ${config.X402_NETWORK} to ${config.PAY_TO}`,
  );
});
