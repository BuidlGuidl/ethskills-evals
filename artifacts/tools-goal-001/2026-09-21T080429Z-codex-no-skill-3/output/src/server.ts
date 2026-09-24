import express, { type NextFunction, type Request, type Response } from "express";
import { HTTPFacilitatorClient, type RoutesConfig } from "@x402/core/server";
import { x402ResourceServer } from "@x402/express";
import { paymentMiddleware } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { getAddress, isAddress } from "viem";
import { summarizeWalletActivity } from "./activity.js";
import { env, requireAddress, requireNetwork } from "./config.js";

const paidRoute = "/v1/wallet/:address/summary";
const payTo = requireAddress("PAY_TO_ADDRESS", env.PAY_TO_ADDRESS);
const paymentNetwork = requireNetwork("PAYMENT_NETWORK", env.PAYMENT_NETWORK);

const app = express();
app.set("trust proxy", true);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    paymentNetwork,
    payTo,
    price: env.PRICE_PER_CALL
  });
});

app.get(paidRoute, validateSummaryRequest);

const facilitator = new HTTPFacilitatorClient({ url: env.FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitator).register(
  paymentNetwork,
  new ExactEvmScheme()
);

const paidRoutes: RoutesConfig = {
  [`GET ${paidRoute}`]: {
    accepts: {
      scheme: "exact",
      price: env.PRICE_PER_CALL,
      network: paymentNetwork,
      payTo
    },
    description: "Short summary of a wallet's recent Base activity",
    mimeType: "application/json",
    serviceName: "Paid Wallet Activity API",
    tags: ["wallet", "base", "summary"],
    unpaidResponseBody: context => ({
      contentType: "application/json",
      body: {
        error: "payment_required",
        message: "Attach an x402 PAYMENT-SIGNATURE header to access this wallet summary.",
        resource: context.adapter.getUrl(),
        price: env.PRICE_PER_CALL,
        network: paymentNetwork,
        payTo
      }
    })
  }
};

app.use(
  paymentMiddleware(
    paidRoutes,
    resourceServer,
    {
      appName: "Paid Wallet Activity API",
      testnet: paymentNetwork !== "eip155:8453"
    }
  )
);

app.get(paidRoute, async (req, res, next) => {
  try {
    const wallet = getAddress(req.params.address);
    const limit = parseLimit(req.query.limit);
    const summary = await summarizeWalletActivity(wallet, limit);

    res.json({
      paid: true,
      payment: {
        network: env.PAYMENT_NETWORK,
        price: env.PRICE_PER_CALL,
        settledTo: payTo
      },
      data: summary
    });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({
    error: "internal_error",
    message: error instanceof Error ? error.message : "Unexpected server error"
  });
});

app.listen(env.PORT, () => {
  console.log(`Paid wallet activity API listening on http://localhost:${env.PORT}`);
  console.log(`Charging ${env.PRICE_PER_CALL} on ${paymentNetwork}; settlement address ${payTo}`);
});

function validateSummaryRequest(req: Request, res: Response, next: NextFunction): void {
  const address = req.params.address;

  if (typeof address !== "string" || !isAddress(address)) {
    res.status(400).json({ error: "invalid_address", message: "Use a valid EVM wallet address." });
    return;
  }

  try {
    parseLimit(req.query.limit);
  } catch (error) {
    res.status(400).json({
      error: "invalid_limit",
      message: error instanceof Error ? error.message : "Invalid limit"
    });
    return;
  }

  next();
}

function parseLimit(value: unknown): number {
  if (value === undefined) {
    return 10;
  }

  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" && typeof raw !== "number") {
    throw new Error("limit must be an integer between 1 and 25");
  }

  const limit = Number(raw);

  if (!Number.isInteger(limit) || limit < 1 || limit > 25) {
    throw new Error("limit must be an integer between 1 and 25");
  }

  return limit;
}
