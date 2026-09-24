import express, { type Request, type Response } from "express";
import { paymentMiddleware, type RoutesConfig } from "x402-express";
import { serverConfig } from "../config.js";
import { summarizeWallet } from "./activity.js";

const config = serverConfig();
const app = express();

const routes: RoutesConfig = {
  "GET /activity": {
    price: config.price,
    network: config.network,
    config: {
      description: "Summary of a wallet's recent on-chain activity on Base.",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
      discoverable: true,
      inputSchema: {
        queryParams: {
          address: "EVM address to summarize (required, 0x-prefixed).",
          limit: "Max number of recent events to return, 1-50 (default 10).",
          windowDays: "How many days back to look (default 30).",
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          address: { type: "string" },
          summary: { type: "string", description: "One-paragraph natural-language summary." },
          account: { type: "object" },
          activity: { type: "object" },
        },
      },
    },
  },
};

// Gates only the routes listed above; everything else stays free.
app.use(paymentMiddleware(config.payTo, routes, config.facilitator));

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, network: config.network });
});

/** Free discovery endpoint so an agent can learn the price before committing to pay. */
app.get("/", (_req: Request, res: Response) => {
  res.json({
    service: "wallet-activity-x402",
    endpoint: "GET /activity?address=0x...",
    price: config.price,
    network: config.network,
    payTo: config.payTo,
    protocol: "x402",
  });
});

app.get("/activity", async (req: Request, res: Response) => {
  // Reaching this handler means the facilitator already verified payment.
  // Returning >= 400 below aborts settlement, so callers are not charged for bad input.
  const address = req.query.address;
  if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: "Query param 'address' must be a 0x-prefixed EVM address." });
    return;
  }

  const limit = req.query.limit === undefined ? undefined : Number(req.query.limit);
  const windowDays = req.query.windowDays === undefined ? undefined : Number(req.query.windowDays);
  if (Number.isNaN(limit) || Number.isNaN(windowDays)) {
    res.status(400).json({ error: "'limit' and 'windowDays' must be numbers." });
    return;
  }

  try {
    const summary = await summarizeWallet(address, {
      network: config.network,
      rpcUrl: config.rpcUrl,
      limit,
      windowDays,
    });
    res.json(summary);
  } catch (error) {
    // 5xx also aborts settlement, so the caller keeps their money if we fail.
    console.error("[activity] failed:", error);
    res.status(502).json({ error: "Could not read on-chain activity. Payment was not settled." });
  }
});

app.listen(config.port, () => {
  console.log(`wallet-activity-x402 listening on http://localhost:${config.port}`);
  console.log(`  network:  ${config.network}`);
  console.log(`  price:    ${config.price} per call to GET /activity`);
  console.log(`  paid to:  ${config.payTo}`);
  console.log(
    `  facilitator: ${config.facilitator ? "Coinbase CDP" : "https://x402.org/facilitator (testnet)"}`,
  );
});
