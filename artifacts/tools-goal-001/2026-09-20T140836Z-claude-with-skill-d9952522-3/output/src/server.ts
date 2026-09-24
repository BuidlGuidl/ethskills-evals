/**
 * Payment-gated wallet activity API.
 *
 * GET /activity/:address returns a summary of the wallet's recent on-chain
 * activity. Without payment it answers 402 with the payment requirements;
 * with a valid X-PAYMENT header the middleware verifies, serves, and settles.
 */
import "dotenv/config";
import express from "express";
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { summarizeWalletActivity } from "./activity.js";

const PORT = Number(process.env.PORT ?? 4021);
const NETWORK = (process.env.NETWORK ?? "eip155:84532") as Network;
const PRICE = process.env.PRICE ?? "$0.02";
const PAY_TO = process.env.PAY_TO;

if (!PAY_TO) {
  throw new Error("PAY_TO is required — it is the address every payment settles to.");
}

/**
 * Builds the facilitator client: Coinbase CDP when keys are present (required
 * for Base mainnet), otherwise the public x402.org facilitator (testnets only).
 *
 * @returns A facilitator client for verify/settle
 */
async function facilitatorClient(): Promise<HTTPFacilitatorClient> {
  const id = process.env.CDP_API_KEY_ID;
  const secret = process.env.CDP_API_KEY_SECRET;
  if (id && secret) {
    // Imported lazily so testnet runs don't need CDP configured at all.
    const { createFacilitatorConfig } = await import("@coinbase/x402");
    return new HTTPFacilitatorClient(createFacilitatorConfig(id, secret));
  }
  if (NETWORK === "eip155:8453") {
    throw new Error(
      "Base mainnet needs CDP_API_KEY_ID / CDP_API_KEY_SECRET — the public x402.org facilitator is testnet-only.",
    );
  }
  return new HTTPFacilitatorClient();
}

const resourceServer = registerExactEvmScheme(
  new x402ResourceServer(await facilitatorClient()),
  { networks: [NETWORK] },
);

const app = express();

app.use(
  paymentMiddleware(
    {
      "GET /activity/*": {
        accepts: [{ scheme: "exact", network: NETWORK, price: PRICE, payTo: PAY_TO }],
        description: "Short summary of a wallet's recent on-chain activity",
        mimeType: "application/json",
        serviceName: "wallet-activity",
        // What an unpaid caller sees alongside the 402, so an agent can decide.
        unpaidResponseBody: () => ({
          contentType: "application/json",
          body: {
            error: "payment required",
            hint: `Pay ${PRICE} in USDC on ${NETWORK} via the x402 X-PAYMENT header.`,
          },
        }),
      },
    },
    resourceServer,
  ),
);

app.get("/activity/:address", async (req, res) => {
  const { address } = req.params;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({ error: "address must be a 0x-prefixed 20-byte hex address" });
    return;
  }
  try {
    res.json(await summarizeWalletActivity(address, NETWORK));
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

// Unpriced, so you can check the process is up without paying.
app.get("/health", (_req, res) => {
  res.json({ ok: true, network: NETWORK, price: PRICE, payTo: PAY_TO });
});

app.listen(PORT, () => {
  console.log(`wallet-activity API on http://localhost:${PORT}`);
  console.log(`  GET /activity/:address — ${PRICE} per call`);
  console.log(`  settles to ${PAY_TO} on ${NETWORK}`);
});
