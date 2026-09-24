import express from "express";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import type { RoutesConfig } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware } from "@x402/express";
import { createFacilitatorConfig } from "@coinbase/x402";
import { isAddress } from "viem";
import { BadAddressError, summarizeWallet } from "./activity.js";
import { chain, chainKey, serverConfig } from "./config.js";

const app = express();
app.use(express.json());

const { network } = chain();
const payTo = serverConfig.payTo();

/**
 * The facilitator is the party that verifies the signed payment and broadcasts
 * the USDC transfer on our behalf. Testnet has a free public one; Base mainnet
 * goes through Coinbase CDP, which needs API keys but never custodies funds —
 * money moves payer -> PAY_TO_ADDRESS directly.
 */
const facilitator = new HTTPFacilitatorClient(
  chainKey() === "base"
    ? createFacilitatorConfig(process.env.CDP_API_KEY_ID, process.env.CDP_API_KEY_SECRET)
    : { url: process.env.FACILITATOR_URL ?? "https://x402.org/facilitator" },
);

const resourceServer = new x402ResourceServer(facilitator);
registerExactEvmScheme(resourceServer);

const routes: RoutesConfig = {
  "GET /summary/:address": {
    accepts: [
      {
        scheme: "exact",
        network,
        payTo,
        price: serverConfig.price,
        maxTimeoutSeconds: 120,
      },
    ],
    description: "Short summary of a wallet's recent on-chain activity",
    mimeType: "application/json",
    serviceName: "wallet-activity-api",
    // Shown to an agent that calls without paying, alongside the 402 requirements.
    unpaidResponseBody: () => ({
      contentType: "application/json",
      body: {
        error: "payment required",
        hint: `Pay ${serverConfig.price} in USDC on ${network} and retry with the X-PAYMENT header.`,
      },
    }),
  },
};

// Runs before the paywall on purpose: a malformed address is our cheapest
// rejection, and the caller should not be charged for a 400.
app.get("/summary/:address", (req, res, next) => {
  if (!isAddress(String(req.params.address))) {
    res.status(400).json({ error: `"${req.params.address}" is not a valid EVM address` });
    return;
  }
  next();
});

app.use(paymentMiddleware(routes, resourceServer));

// Free: lets an agent discover price and network before committing to a call.
app.get("/", (_req, res) => {
  res.json({
    service: "wallet-activity-api",
    endpoint: "GET /summary/:address",
    price: serverConfig.price,
    network,
    asset: chain().usdc,
    payTo,
    protocol: "x402",
  });
});

// Paid: the middleware above only lets us get here once payment is verified.
app.get("/summary/:address", async (req, res) => {
  try {
    const summary = await summarizeWallet(String(req.params.address));
    res.json(summary);
  } catch (err) {
    if (err instanceof BadAddressError) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error("summary failed:", err);
    res.status(502).json({ error: "upstream data provider failed" });
  }
});

app.listen(serverConfig.port, () => {
  console.log(`wallet-activity-api listening on http://localhost:${serverConfig.port}`);
  console.log(`  network:  ${network} (${chainKey()})`);
  console.log(`  price:    ${serverConfig.price} USDC per call`);
  console.log(`  settles to: ${payTo}`);
});
