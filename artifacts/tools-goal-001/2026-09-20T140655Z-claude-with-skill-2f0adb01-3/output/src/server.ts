import express from "express";
import { paymentMiddlewareFromHTTPServer } from "@x402/express";
import {
  x402HTTPResourceServer,
  x402ResourceServer,
  type RoutesConfig,
} from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { isAddress } from "viem";
import { chain, networkKey, PORT, PRICE } from "./config.js";
import { createFacilitatorClient } from "./facilitator.js";
import { BadAddressError, summarizeWallet } from "./summary.js";

const PAY_TO = process.env.PAY_TO;
if (!PAY_TO || !isAddress(PAY_TO)) {
  throw new Error("PAY_TO must be set to the EVM address that receives payments");
}

const ROUTE = "/v1/wallet/:address/summary";

const routes: RoutesConfig = {
  [`GET ${ROUTE}`]: {
    accepts: {
      scheme: "exact",
      network: chain.network,
      price: PRICE,
      payTo: PAY_TO,
      maxTimeoutSeconds: 120,
    },
    description: "Short summary of a wallet's recent on-chain activity",
    mimeType: "application/json",
    serviceName: "wallet-summary",
    // Returned to a caller that has not paid yet, alongside the 402 payment
    // requirements, so an agent can decide whether this is worth paying for.
    unpaidResponseBody: () => ({
      contentType: "application/json",
      body: {
        error: "payment required",
        price: PRICE,
        network: chain.network,
        docs: `GET ${ROUTE}`,
      },
    }),
  },
};

const resourceServer = new x402ResourceServer(createFacilitatorClient());
registerExactEvmScheme(resourceServer, { networks: [chain.network] });

const httpServer = new x402HTTPResourceServer(resourceServer, routes).onProtectedRequest(
  async (context) => {
    // Reject malformed input *before* any payment is verified or settled, so a
    // caller is never charged for a request we were always going to refuse.
    const address = context.path.split("/")[3] ?? "";
    if (!isAddress(address)) {
      return { abort: true, reason: `"${address}" is not a valid EVM address` };
    }
  },
);

const app = express();
app.use(express.json());
app.use(paymentMiddlewareFromHTTPServer(httpServer));

// Free: lets an agent discover price and network before committing to a call.
app.get("/", (_req, res) => {
  res.json({
    service: "wallet-summary",
    paidEndpoint: `GET ${ROUTE}`,
    price: PRICE,
    network: chain.network,
    asset: chain.usdc,
    payTo: PAY_TO,
  });
});

// Paid: the middleware above only reaches this handler once payment verifies.
app.get(ROUTE, async (req, res) => {
  try {
    res.json(await summarizeWallet(req.params.address));
  } catch (error) {
    if (error instanceof BadAddressError) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error("[wallet-summary] failed:", error);
    res.status(502).json({ error: "upstream chain data unavailable" });
  }
});

app.listen(PORT, () => {
  console.log(`wallet-summary listening on http://localhost:${PORT}`);
  console.log(`  paid route : GET ${ROUTE}  (${PRICE})`);
  console.log(`  settles on : ${networkKey} (${chain.network}) in USDC ${chain.usdc}`);
  console.log(`  payments to: ${PAY_TO}`);
});
