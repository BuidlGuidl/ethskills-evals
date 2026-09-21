import "dotenv/config";

import { HTTPFacilitatorClient } from "@x402/core/server";
import type { RoutesConfig } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import express, { type NextFunction, type Request, type Response } from "express";
import { getAddress, isAddress, type Address } from "viem";

import { summarizeWalletActivity } from "./walletActivity.js";

const PORT = Number(process.env.PORT ?? 3000);
const PAY_TO_ADDRESS = requireAddress(process.env.PAY_TO_ADDRESS, "PAY_TO_ADDRESS");
const X402_PRICE = process.env.X402_PRICE ?? "$0.03";
const X402_NETWORK = requireNetwork(process.env.X402_NETWORK ?? "eip155:8453");
const X402_FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL ?? "https://facilitator.openx402.ai";
const BASE_RPC_URL = process.env.BASE_RPC_URL;
const RECENT_BLOCK_LOOKBACK = Number(process.env.RECENT_BLOCK_LOOKBACK ?? 80);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? `http://localhost:${PORT}`;

function requireAddress(value: string | undefined, label: string): Address {
  if (!value || !isAddress(value)) {
    throw new Error(`${label} must be set to a valid EVM address`);
  }

  return getAddress(value);
}

function requireNetwork(value: string): Network {
  if (!/^[a-z0-9-]+:[a-zA-Z0-9-]+$/.test(value)) {
    throw new Error(`X402_NETWORK must be a CAIP-2 network id, got "${value}".`);
  }

  return value as Network;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    network: X402_NETWORK,
    payTo: PAY_TO_ADDRESS,
    price: X402_PRICE,
    facilitator: X402_FACILITATOR_URL,
  });
});

const resourceServer = new x402ResourceServer(
  new HTTPFacilitatorClient({
    url: X402_FACILITATOR_URL,
    timeoutMs: 30_000,
  }),
).register(X402_NETWORK, new ExactEvmScheme());

const routes = {
  "GET /v1/wallet/:address/summary": {
    accepts: {
      scheme: "exact",
      network: X402_NETWORK,
      payTo: PAY_TO_ADDRESS,
      price: X402_PRICE,
      maxTimeoutSeconds: 120,
    },
    resource: `${PUBLIC_BASE_URL}/v1/wallet/{address}/summary`,
    description:
      "Short summary of a wallet's recent Base activity, including balance and recent Transfer events.",
    mimeType: "application/json",
    serviceName: "Paid wallet activity summary",
    tags: ["wallet", "base", "summary", "agent-api"],
    unpaidResponseBody: () => ({
      contentType: "application/json",
      body: {
        error: "payment_required",
        message:
          "Call this endpoint with an x402-compatible client. The 402 response includes the payment terms.",
      },
    }),
  },
} satisfies RoutesConfig;

app.use(paymentMiddleware(routes, resourceServer));

app.get(
  "/v1/wallet/:address/summary",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const walletAddress = String(req.params.address);

      if (!isAddress(walletAddress)) {
        res.status(400).json({ error: "invalid_wallet_address" });
        return;
      }

      const activity = await summarizeWalletActivity(walletAddress, {
        network: X402_NETWORK,
        rpcUrl: BASE_RPC_URL,
        lookbackBlocks: RECENT_BLOCK_LOOKBACK,
      });

      res.json({
        paid: true,
        price: X402_PRICE,
        settlesTo: PAY_TO_ADDRESS,
        settlementNetwork: X402_NETWORK,
        activity,
      });
    } catch (error) {
      next(error);
    }
  },
);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({
    error: "server_error",
    message: getErrorMessage(error),
  });
});

app.listen(PORT, () => {
  console.log(`paid wallet summary API listening on http://localhost:${PORT}`);
  console.log(`${X402_PRICE} settles to ${PAY_TO_ADDRESS} on ${X402_NETWORK}`);
});
