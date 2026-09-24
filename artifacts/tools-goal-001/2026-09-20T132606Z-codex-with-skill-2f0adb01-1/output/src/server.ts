import "dotenv/config";

import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import express from "express";
import { z } from "zod";

import { getWalletActivitySummary } from "./activity.js";

const envSchema = z.object({
  PAY_TO_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "PAY_TO_ADDRESS must be an EVM address"),
  PRICE_USD: z.string().default("$0.02"),
  X402_NETWORK: z.string().regex(/^[a-z0-9]+:[A-Za-z0-9]+$/, "X402_NETWORK must use CAIP-2 format").default("eip155:8453"),
  FACILITATOR_URL: z.string().url().default("https://api.cdp.coinbase.com/platform/v2/x402"),
  PORT: z.coerce.number().int().positive().default(4021),
  BASE_BLOCKSCOUT_API: z.string().url().default("https://base.blockscout.com/api/v2"),
});

const env = envSchema.parse(process.env);
const x402Network = env.X402_NETWORK as `${string}:${string}`;
const app = express();

const facilitatorClient = new HTTPFacilitatorClient({
  url: env.FACILITATOR_URL,
});

const resourceServer = new x402ResourceServer(facilitatorClient).register(
  x402Network,
  new ExactEvmScheme(),
);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    paidRoute: "/v1/wallet/summary?address=0x...",
    network: env.X402_NETWORK,
    price: env.PRICE_USD,
  });
});

app.use(
  paymentMiddleware(
    {
      "GET /v1/wallet/summary": {
        accepts: [
          {
            scheme: "exact",
            price: env.PRICE_USD,
            network: x402Network,
            payTo: env.PAY_TO_ADDRESS,
          },
        ],
        description: "Short summary of a wallet's recent on-chain activity on Base",
        mimeType: "application/json",
      },
    },
    resourceServer,
  ),
);

app.get("/v1/wallet/summary", async (req, res, next) => {
  try {
    const address = z.string().parse(req.query.address);
    const report = await getWalletActivitySummary(address, env.BASE_BLOCKSCOUT_API);
    res.json(report);
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
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("valid EVM address") || message.includes("Expected string") ? 400 : 500;
    res.status(status).json({ error: message });
  },
);

app.listen(env.PORT, () => {
  console.log(`paid wallet-summary API listening on http://localhost:${env.PORT}`);
  console.log(`x402 payments settle to ${env.PAY_TO_ADDRESS} on ${env.X402_NETWORK}`);
});
