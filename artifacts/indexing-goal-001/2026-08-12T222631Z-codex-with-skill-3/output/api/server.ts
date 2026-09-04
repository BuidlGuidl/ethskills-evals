import "dotenv/config";
import express from "express";
import { getFeed, getLeaderboard, getProfile, monthIndex } from "./subgraph.js";

const app = express();
const addressPattern = /^0x[0-9a-fA-F]{40}$/;

function boundedInt(value: unknown, fallback: number, maximum: number) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, maximum) : fallback;
}

app.use((_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});

app.get("/feed", async (request, response, next) => {
  try {
    response.json(await getFeed(
      boundedInt(request.query.limit, 50, 100),
      boundedInt(request.query.skip, 0, 5_000),
    ));
  } catch (error) {
    next(error);
  }
});

app.get("/members/:address", async (request, response, next) => {
  try {
    if (!addressPattern.test(request.params.address)) {
      response.status(400).json({ error: "Invalid address" });
      return;
    }
    const profile = await getProfile(request.params.address, Math.floor(Date.now() / 1_000));
    response.status(profile ? 200 : 404).json(profile ?? { error: "Member not found" });
  } catch (error) {
    next(error);
  }
});

app.get("/leaderboard", async (request, response, next) => {
  try {
    const requestedMonth = typeof request.query.month === "string" ? request.query.month : "";
    const date = requestedMonth ? new Date(`${requestedMonth}-01T00:00:00Z`) : new Date();
    if (Number.isNaN(date.valueOf()) || (requestedMonth && !/^\d{4}-\d{2}$/.test(requestedMonth))) {
      response.status(400).json({ error: "month must be YYYY-MM" });
      return;
    }
    response.json(await getLeaderboard(monthIndex(date), boundedInt(request.query.limit, 100, 1000)));
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  response.status(502).json({ error: "Subgraph request failed" });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Streak read API listening on http://localhost:${port}`));
