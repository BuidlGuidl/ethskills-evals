import express from "express";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { facilitator as coinbaseFacilitator } from "@coinbase/x402";
import { getWalletActivity } from "./activity.js";
import { CHAIN, NETWORK, PORT, PRICE, SERVER_URL } from "./config.js";

const PAY_TO = process.env.PAY_TO;
if (!PAY_TO) {
  throw new Error("PAY_TO is required: the address that receives the USDC payments.");
}

/**
 * Where the money actually moves: the facilitator verifies the signed payment
 * and broadcasts the USDC transfer to PAY_TO on the configured Base network.
 *
 * - base-sepolia: the public x402.org facilitator (default URL), no credentials.
 * - base mainnet: Coinbase CDP, which needs CDP_API_KEY_ID / CDP_API_KEY_SECRET.
 */
const facilitatorClient =
  CHAIN === "base"
    ? new HTTPFacilitatorClient(coinbaseFacilitator)
    : new HTTPFacilitatorClient();

const app = express();
app.use(express.json());

app.use(
  paymentMiddlewareFromConfig(
    {
      "GET /activity/*": {
        accepts: {
          scheme: "exact",
          network: NETWORK,
          payTo: PAY_TO,
          price: PRICE,
          maxTimeoutSeconds: 120,
        },
        description: "Short summary of a wallet's recent onchain activity on Base.",
        mimeType: "application/json",
        serviceName: "wallet-activity",
        // Shown to an agent that calls without payment, so it can decide to pay.
        unpaidResponseBody: () => ({
          contentType: "application/json",
          body: {
            error: "payment required",
            price: PRICE,
            docs: `${SERVER_URL}/`,
          },
        }),
      },
    },
    facilitatorClient,
    [{ network: NETWORK, server: new ExactEvmScheme() }],
  ),
);

/** Free: lets an agent discover the endpoint and its price before paying. */
app.get("/", (_req, res) => {
  res.json({
    service: "wallet-activity",
    chain: CHAIN,
    network: NETWORK,
    paidEndpoint: "GET /activity/:address",
    price: PRICE,
    payTo: PAY_TO,
    protocol: "x402",
  });
});

app.get("/activity/:address", async (req, res) => {
  const { address } = req.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: "address must be a 0x-prefixed 20-byte hex address" });
    return;
  }

  try {
    const limit = Math.min(Number(req.query.limit ?? 5) || 5, 20);
    res.json(await getWalletActivity(address, limit));
  } catch (error) {
    console.error("activity lookup failed", error);
    res.status(502).json({ error: "upstream activity lookup failed" });
  }
});

app.listen(PORT, () => {
  console.log(`wallet-activity listening on ${SERVER_URL}`);
  console.log(`  chain:  ${CHAIN} (${NETWORK})`);
  console.log(`  price:  ${PRICE} per call, settling to ${PAY_TO}`);
});
