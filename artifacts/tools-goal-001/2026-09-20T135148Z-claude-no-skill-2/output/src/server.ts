import express from "express";
import { paymentMiddleware, type RoutesConfig } from "x402-express";
import type { FacilitatorConfig } from "x402/types";
import { NETWORK, serverConfig } from "./config.js";
import { summarizeWallet, type WalletSummary } from "./activity.js";

const app = express();

/**
 * The x402.org facilitator only settles on testnets. For mainnet Base we use
 * Coinbase CDP's facilitator, which needs CDP_API_KEY_ID / CDP_API_KEY_SECRET.
 */
async function resolveFacilitator(): Promise<FacilitatorConfig | undefined> {
  if (NETWORK !== "base") return undefined;
  if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET) {
    throw new Error(
      "NETWORK=base requires CDP_API_KEY_ID and CDP_API_KEY_SECRET (https://portal.cdp.coinbase.com). " +
        "Use NETWORK=base-sepolia to run against the free public facilitator.",
    );
  }
  const { facilitator } = await import("@coinbase/x402");
  return facilitator;
}

const routes: RoutesConfig = {
  "GET /wallet/[address]/summary": {
    price: serverConfig.price,
    network: NETWORK,
    config: {
      description: "A short summary of a wallet's recent on-chain activity on Base.",
      mimeType: "application/json",
      outputSchema: {
        type: "object",
        properties: {
          address: { type: "string" },
          summary: { type: "string", description: "Human-readable one-paragraph summary" },
          balance: { type: "object" },
          accountType: { type: "string", enum: ["eoa", "contract"] },
          outboundTxCount: { type: "number" },
          recent: { type: "object" },
        },
      },
    },
  },
};

// Free: lets an agent discover the price and shape before paying.
app.get("/", (_req, res) => {
  res.json({
    service: "wallet-activity-x402",
    protocol: "x402",
    network: NETWORK,
    price: serverConfig.price,
    payTo: serverConfig.payTo,
    paidEndpoints: ["GET /wallet/:address/summary"],
    hint: "Call a paid endpoint without payment to get the 402 challenge with full payment requirements.",
  });
});

app.get("/healthz", (_req, res) => res.json({ ok: true }));

const facilitator = await resolveFacilitator();
app.use(paymentMiddleware(serverConfig.payTo, routes, facilitator));

// Everything below this line is only reached after payment has been verified.
app.get("/wallet/:address/summary", async (req, res) => {
  try {
    res.json(await summarizeWallet(req.params.address));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const badInput = /not a valid EVM address/.test(message);
    res.status(badInput ? 400 : 502).json({ error: message });
  }
});

app.listen(serverConfig.port, () => {
  console.log(`wallet-activity-x402 listening on http://localhost:${serverConfig.port}`);
  console.log(`  network:  ${NETWORK}`);
  console.log(`  price:    ${serverConfig.price} per call (USDC)`);
  console.log(`  payments settle to: ${serverConfig.payTo}`);
});
