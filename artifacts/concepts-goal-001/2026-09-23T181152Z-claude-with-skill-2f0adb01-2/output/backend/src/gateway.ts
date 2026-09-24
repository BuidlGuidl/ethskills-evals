import express, { type NextFunction, type Request, type Response } from "express";
import { isAddress, type Address } from "viem";
import { checkSubscription, watchRevocations } from "./billing.js";
import { issueNonce, loginMessage, login, verifyToken } from "./auth.js";
import { config } from "./config.js";

/**
 * The weather API, gated on an onchain subscription.
 *
 * The only thing worth studying here is `requireSubscription`: it is a plain read
 * of a view function, with no dependency on any job having run. If the settlement
 * keeper has been down for a month, this still answers correctly.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      account?: Address;
      planId?: number;
    }
  }
}

const app = express();
app.use(express.json());

// --- auth ---------------------------------------------------------------

app.get("/auth/nonce", (req: Request, res: Response) => {
  const address = String(req.query.address ?? "");
  if (!isAddress(address)) return res.status(400).json({ error: "bad address" });
  const nonce = issueNonce();
  res.json({ nonce, message: loginMessage(address, nonce) });
});

app.post("/auth/login", async (req: Request, res: Response) => {
  const { address, nonce, signature } = req.body ?? {};
  if (!isAddress(address ?? "")) return res.status(400).json({ error: "bad address" });
  try {
    const token = await login(address, String(nonce), signature);
    res.json({ token, expiresInSeconds: 900 });
  } catch (err) {
    res.status(401).json({ error: (err as Error).message });
  }
});

// --- gating -------------------------------------------------------------

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const account = token ? verifyToken(token) : null;
  if (!account) return res.status(401).json({ error: "sign in with your wallet" });
  req.account = account;
  next();
}

async function requireSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const { subscribed, planId } = await checkSubscription(req.account!);
    if (!subscribed) {
      return res.status(402).json({
        error: "no active subscription",
        // 402 Payment Required is the honest status code here, and telling the
        // client exactly where to fix it is the whole UX.
        contract: config.billingAddress,
        chainId: config.chain.id,
        hint: "deposit USDC and call subscribe(planId), then retry",
      });
    }
    req.planId = planId;
    next();
  } catch (err) {
    // An RPC outage must not silently become "everyone gets in" or "nobody does"
    // without it being visible. Fail closed, but loudly.
    console.error("[gateway] subscription check failed", err);
    res.status(503).json({ error: "billing check unavailable, retry shortly" });
  }
}

const RATE_LIMITS: Record<number, number> = { 1: 1_000, 2: 10_000 }; // reqs/day by plan

app.get("/v1/forecast", requireAuth, requireSubscription, (req: Request, res: Response) => {
  res.json({
    account: req.account,
    planId: req.planId,
    dailyRequestLimit: RATE_LIMITS[req.planId!] ?? 0,
    forecast: { tempC: 14, conditions: "light rain" }, // your actual weather data here
  });
});

app.get("/healthz", (_req: Request, res: Response) => res.json({ ok: true }));

const stopWatching = watchRevocations();
const server = app.listen(config.port, () => {
  console.log(`gateway listening on :${config.port} (chain ${config.chain.id})`);
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    stopWatching();
    server.close(() => process.exit(0));
  });
}
