/**
 * Paid wallet-activity API.
 *
 * GET /activity/:address is gated by x402: unpaid requests get a 402 with payment
 * requirements, paid requests (X-PAYMENT header) are verified + settled by a
 * facilitator before the handler runs, and the settlement tx hash comes back in
 * the X-PAYMENT-RESPONSE header.
 */
import "dotenv/config";
import express from "express";
import { isAddress } from "viem";
import { paymentMiddleware } from "@x402/express";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { facilitator as coinbaseFacilitator } from "@coinbase/x402";
import { requireEnv, resolveNetwork } from "../config.js";
import { getWalletActivity, UpstreamError } from "./activity.js";

const network = resolveNetwork();
const payTo = requireEnv("PAY_TO");
const price = process.env.PRICE ?? "$0.01";
const port = Number(process.env.PORT ?? 4021);

if (!isAddress(payTo)) throw new Error(`PAY_TO is not a valid address: ${payTo}`);

/**
 * Testnet settles through the public x402 Foundation facilitator (no keys).
 * Base mainnet settles through the Coinbase CDP facilitator, which reads
 * CDP_API_KEY_ID / CDP_API_KEY_SECRET from the environment.
 */
const facilitatorConfig =
  network.facilitatorUrl !== undefined
    ? { url: process.env.FACILITATOR_URL ?? network.facilitatorUrl }
    : coinbaseFacilitator;

if (network.name === "base" && !process.env.CDP_API_KEY_ID) {
  throw new Error("Base mainnet needs CDP_API_KEY_ID / CDP_API_KEY_SECRET for the Coinbase facilitator");
}

const resourceServer = new x402ResourceServer(new HTTPFacilitatorClient(facilitatorConfig));
registerExactEvmScheme(resourceServer, { networks: [network.caip2] });

const app = express();
app.use(express.json());

/** Reject malformed addresses before the payment middleware charges for them. */
app.use("/activity/:address", (req, res, next) => {
  if (!isAddress(req.params.address)) {
    res.status(400).json({ error: `Not a valid EVM address: ${req.params.address}` });
    return;
  }
  next();
});

app.use(
  paymentMiddleware(
    {
      "GET /activity/:address": {
        accepts: [{ scheme: "exact", network: network.caip2, price, payTo }],
        description: "Summary of a wallet's recent on-chain activity",
        mimeType: "application/json",
        serviceName: "wallet-activity-api",
        // Surfaces why a payment was rejected instead of an empty body.
        settlementFailedResponseBody: (_ctx, settleResult) => ({
          contentType: "application/json",
          body: {
            error: "payment settlement failed",
            reason: settleResult.errorReason ?? settleResult.errorMessage ?? "unknown",
          },
        }),
        // Shown to agents that hit the endpoint without paying.
        unpaidResponseBody: () => ({
          contentType: "application/json",
          body: {
            error: "payment required",
            price,
            network: network.name,
            hint: "Retry with an X-PAYMENT header, or use an x402-aware client.",
          },
        }),
      },
    },
    resourceServer,
  ),
);

/** Free: lets an agent discover price and network before committing to a call. */
app.get("/", (_req, res) => {
  res.json({
    service: "wallet-activity-api",
    paidEndpoint: "GET /activity/:address",
    price,
    network: network.name,
    caip2: network.caip2,
    payTo,
    protocol: "x402",
  });
});

app.get("/activity/:address", async (req, res) => {
  const address = req.params.address;

  try {
    res.json(await getWalletActivity(address, network));
  } catch (err) {
    const status = err instanceof UpstreamError ? err.status : 500;
    res.status(status).json({ error: (err as Error).message });
  }
});

app.listen(port, () => {
  console.log(`wallet-activity-api listening on http://localhost:${port}`);
  console.log(`  network:     ${network.name} (${network.caip2})`);
  console.log(`  price:       ${price} per call, paid to ${payTo}`);
  console.log(`  facilitator: ${"url" in facilitatorConfig ? facilitatorConfig.url : "Coinbase CDP"}`);
});
