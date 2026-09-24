/**
 * Payment-gated wallet activity API.
 *
 * GET /v1/wallet/:address  -- 402 Payment Required until the caller attaches a
 * signed USDC payment in the X-PAYMENT header, then 200 with the summary.
 *
 * The x402 middleware does all of the protocol work: it answers unpaid requests
 * with the price quote, verifies the caller's signed payment against a
 * facilitator, runs the handler, and settles on-chain. Nothing is stored here --
 * no accounts, no keys, no invoices.
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { paymentMiddleware, type RoutesConfig } from "x402-hono";
import { facilitator as coinbaseFacilitator } from "@coinbase/x402";
import type { FacilitatorConfig } from "x402/types";
import { IS_MAINNET, NETWORK, PORT, USDC_ADDRESS, serverConfig } from "./config.js";
import { InvalidAddressError, summarizeWallet } from "./activity.js";

const { payTo, price } = serverConfig();

/**
 * Who verifies and broadcasts the payment.
 *  - base-sepolia: the public x402.org facilitator (the middleware's default).
 *  - base mainnet: Coinbase's facilitator, which needs CDP API keys in the env.
 * Either way the USDC moves from the caller straight to payTo; the facilitator
 * only relays the transfer and never custodies funds.
 */
function resolveFacilitator(): FacilitatorConfig | undefined {
  if (!IS_MAINNET) return undefined;
  if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET) {
    throw new Error(
      "NETWORK=base requires CDP_API_KEY_ID and CDP_API_KEY_SECRET (https://portal.cdp.coinbase.com) " +
        "so the Coinbase facilitator can settle mainnet payments.",
    );
  }
  return coinbaseFacilitator as unknown as FacilitatorConfig;
}

const routes: RoutesConfig = {
  "GET /v1/wallet/*": {
    price,
    network: NETWORK,
    config: {
      description: "Short summary of a wallet's recent on-chain activity on Base",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
    },
  },
};

const app = new Hono();

// Free: lets an agent discover what this costs before it commits to paying.
app.get("/", c =>
  c.json({
    service: "wallet-activity",
    paidEndpoint: "GET /v1/wallet/:address",
    price,
    network: NETWORK,
    asset: { symbol: "USDC", address: USDC_ADDRESS },
    payTo,
    protocol: "x402",
  }),
);

app.get("/health", c => c.json({ ok: true }));

// Everything below this line costs money.
app.use(paymentMiddleware(payTo, routes, resolveFacilitator()));

app.get("/v1/wallet/:address", async c => {
  try {
    return c.json(await summarizeWallet(c.req.param("address")));
  } catch (err) {
    if (err instanceof InvalidAddressError) {
      return c.json({ error: err.message }, 400);
    }
    console.error("summary failed:", err);
    return c.json({ error: "Failed to summarize wallet" }, 502);
  }
});

serve({ fetch: app.fetch, port: PORT }, info => {
  console.log(`wallet-activity listening on http://localhost:${info.port}`);
  console.log(`  network:  ${NETWORK}`);
  console.log(`  price:    ${price} per call, paid in USDC (${USDC_ADDRESS})`);
  console.log(`  settles to: ${payTo}`);
});
