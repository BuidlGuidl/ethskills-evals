// Minimal example of the gate in front of the actual API. Run with:
//   SUBSCRIPTIONS_ADDRESS=0x... TOKEN_SECRET=$(openssl rand -hex 32) RPC_URL=... node backend/server.mjs
import express from "express";
import { requireSubscription, issueNonce, loginMessage, login, watchForChanges } from "./gate.mjs";

const app = express();
app.use(express.json());

// --- sign-in: prove you control the address that is paying ---
app.get("/auth/nonce", (req, res) => {
  const nonce = issueNonce();
  res.json({ nonce, message: loginMessage(req.query.address ?? "<your address>", nonce) });
});

app.post("/auth/login", async (req, res) => {
  try {
    res.json({ token: await login(req.body) });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// --- the paid endpoint ---
app.get("/v1/forecast", requireSubscription(), async (req, res) => {
  res.json({ plan: req.subscriber.name, forecast: { tempC: 14, summary: "light rain" } });
});

// Unauthenticated, so customers can debug their own billing without a token.
app.get("/v1/health", (_req, res) => res.json({ ok: true }));

watchForChanges();
app.listen(process.env.PORT ?? 3000, () => console.log("listening"));
