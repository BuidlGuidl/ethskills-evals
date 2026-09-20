import express from "express";
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import type { FacilitatorConfig } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { createFacilitatorConfig } from "@coinbase/x402";

import { loadConfig, type ServerConfig } from "./config.js";
import { summarizeWallet, UpstreamError } from "./activity.js";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * Picks the facilitator that verifies and settles payments.
 *
 * The public x402.org facilitator is testnet-only. Settling on Base mainnet
 * goes through Coinbase's CDP facilitator, which requires API keys.
 */
function facilitatorFor(config: ServerConfig): FacilitatorConfig {
  if (config.chain === "base") {
    if (!config.cdpApiKeyId || !config.cdpApiKeySecret) {
      throw new Error(
        "CHAIN=base settles on Base mainnet, which needs the Coinbase CDP facilitator. " +
          "Set CDP_API_KEY_ID and CDP_API_KEY_SECRET, or use CHAIN=base-sepolia.",
      );
    }
    return createFacilitatorConfig(config.cdpApiKeyId, config.cdpApiKeySecret);
  }
  return { url: "https://x402.org/facilitator" };
}

const config = loadConfig();

const resourceServer = new x402ResourceServer(new HTTPFacilitatorClient(facilitatorFor(config)));
registerExactEvmScheme(resourceServer, { networks: [config.network] });

const app = express();
app.use(express.json());

app.use(
  paymentMiddleware(
    {
      "GET /activity/:address": {
        accepts: {
          scheme: "exact",
          network: config.network,
          payTo: config.payTo,
          price: config.price,
          // Give the agent room to sign and the facilitator room to settle.
          maxTimeoutSeconds: 120,
        },
        description: "Short summary of a wallet's recent on-chain activity",
        mimeType: "application/json",
        serviceName: "Wallet Activity API",
        // Shown to unpaid callers so an agent can decide whether to pay.
        unpaidResponseBody: () => ({
          contentType: "application/json",
          body: {
            error: "payment required",
            price: config.price,
            asset: "USDC",
            chain: config.chain,
          },
        }),
      },
    },
    resourceServer,
  ),
);

/** Unpaid: lets agents discover the endpoint and its price before committing. */
app.get("/", (_req, res) => {
  res.json({
    service: "Wallet Activity API",
    endpoint: "/activity/:address",
    price: config.price,
    asset: "USDC",
    chain: config.chain,
    network: config.network,
    payTo: config.payTo,
    protocol: "x402",
  });
});

app.get("/activity/:address", async (req, res) => {
  const address = req.params.address;
  if (!ADDRESS_RE.test(address)) {
    res.status(400).json({ error: "address must be a 0x-prefixed 20-byte address" });
    return;
  }

  try {
    const result = await summarizeWallet(address, {
      blockscoutUrl: config.blockscout,
      chain: config.chain,
    });
    res.json(result);
  } catch (error) {
    // The payment already settled by the time the handler runs, so make the
    // failure explicit rather than returning an empty summary.
    const message = error instanceof UpstreamError ? error.message : "failed to summarize wallet";
    console.error(`[activity] ${address}:`, error);
    res.status(502).json({ error: message });
  }
});

app.listen(config.port, () => {
  console.log(`Wallet Activity API on http://localhost:${config.port}`);
  console.log(`  price:    ${config.price} USDC per call`);
  console.log(`  chain:    ${config.chain} (${config.network})`);
  console.log(`  payTo:    ${config.payTo}`);
  console.log(`  explorer: ${config.explorer}/address/${config.payTo}`);
});
