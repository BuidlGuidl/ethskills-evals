import cors from "cors";
import express from "express";
import { loadConfig } from "./config.js";
import { createPool, getLastIndexedBlock, initSchema } from "./db.js";
import { getFeed, getMemberProfile, getMonthlyLeaderboard } from "./readModel.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = createPool(config.DATABASE_URL);
  await initSchema(pool);

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", async (_request, response, next) => {
    try {
      const lastIndexedBlock = await getLastIndexedBlock(pool);
      response.json({ ok: true, lastIndexedBlock: lastIndexedBlock?.toString() ?? null });
    } catch (error) {
      next(error);
    }
  });

  app.get("/feed", async (request, response, next) => {
    try {
      const limit = Number(request.query.limit ?? 50);
      const cursor = typeof request.query.cursor === "string" ? request.query.cursor : undefined;
      response.json(await getFeed(pool, { limit, cursor }));
    } catch (error) {
      next(error);
    }
  });

  app.get("/feed/stream", async (request, response, next) => {
    const listenClient = await pool.connect();
    try {
      response.writeHead(200, {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
      });
      response.write("\n");

      listenClient.on("notification", (message) => {
        if (message.channel === "check_ins" && message.payload) {
          response.write(`event: check_in\ndata: ${message.payload}\n\n`);
        }
      });
      await listenClient.query("listen check_ins");

      request.on("close", () => {
        void listenClient.query("unlisten check_ins").finally(() => listenClient.release());
      });
    } catch (error) {
      listenClient.release();
      next(error);
    }
  });

  app.get("/members/:address", async (request, response, next) => {
    try {
      response.json(await getMemberProfile(pool, request.params.address));
    } catch (error) {
      next(error);
    }
  });

  app.get("/leaderboard/month", async (request, response, next) => {
    try {
      const now = new Date();
      const defaultMonth = `${now.getUTCFullYear()}-${`${now.getUTCMonth() + 1}`.padStart(2, "0")}`;
      const monthKey = typeof request.query.month === "string" ? request.query.month : defaultMonth;
      const limit = Number(request.query.limit ?? 50);
      response.json(await getMonthlyLeaderboard(pool, { monthKey, limit }));
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.startsWith("Invalid") || message.includes("must use") || message.includes("Month must") ? 400 : 500;
    response.status(status).json({ error: message });
  });

  app.listen(config.PORT, () => {
    console.log(`Streak read API listening on http://localhost:${config.PORT}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

