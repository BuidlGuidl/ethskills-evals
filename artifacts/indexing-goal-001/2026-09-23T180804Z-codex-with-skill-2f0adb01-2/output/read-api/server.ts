import express from "express";
import {
  createSubgraphClient,
  getFeed,
  getMemberProfile,
  getMonthlyLeaderboard,
} from "./queries.js";

const app = express();
const port = Number(process.env.PORT ?? 8787);
const client = createSubgraphClient();

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/feed", async (request, response, next) => {
  try {
    const items = await getFeed(client, {
      limit: numberQuery(request.query.limit),
      skip: numberQuery(request.query.skip),
    });

    response.json({ items });
  } catch (error) {
    next(error);
  }
});

app.get("/members/:address", async (request, response, next) => {
  try {
    const profile = await getMemberProfile(client, request.params.address);
    response.json(profile);
  } catch (error) {
    next(error);
  }
});

app.get("/leaderboard", async (request, response, next) => {
  try {
    const leaderboard = await getMonthlyLeaderboard(client, {
      month: stringQuery(request.query.month),
      limit: numberQuery(request.query.limit),
      skip: numberQuery(request.query.skip),
    });

    response.json(leaderboard);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  const status = message.startsWith("Expected ") ? 400 : 500;
  response.status(status).json({ error: message });
});

app.listen(port, () => {
  console.log(`Streak read API listening on http://localhost:${port}`);
});

function stringQuery(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return undefined;
}

function numberQuery(value: unknown): number | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
