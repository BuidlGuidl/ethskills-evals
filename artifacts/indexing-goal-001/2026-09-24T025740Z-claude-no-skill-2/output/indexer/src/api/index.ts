import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { count, eq } from "ponder";
import { client, graphql } from "ponder";

import { currentDay, formatMonth, monthFromDay, SECONDS_PER_DAY } from "../lib/time";
import feed from "./feed";
import leaderboard from "./leaderboard";
import profile from "./profile";

const app = new Hono();

// The three screens are read-only and public.
app.use("*", cors({ origin: process.env.CORS_ORIGIN ?? "*" }));

// Purpose-built JSON endpoints for the three screens.
app.route("/api", feed);
app.route("/api", profile);
app.route("/api", leaderboard);

/** GET /api/stats — community-wide totals, for a header or landing card. */
app.get("/api/stats", async (c) => {
  const today = currentDay();

  const [row] = await db.select().from(schema.stats).where(eq(schema.stats.id, "global")).limit(1);
  const [todayRow] = await db
    .select({ n: count() })
    .from(schema.dayActivity)
    .where(eq(schema.dayActivity.day, today));

  return c.json({
    totalCheckIns: row?.totalCheckIns ?? 0,
    totalMembers: row?.totalMembers ?? 0,
    checkInsToday: todayRow?.n ?? 0,
    today: new Date(today * SECONDS_PER_DAY * 1000).toISOString().slice(0, 10),
    currentMonth: formatMonth(monthFromDay(today)),
    firstCheckInDay: row ? new Date(row.firstDay * SECONDS_PER_DAY * 1000).toISOString().slice(0, 10) : null,
    lastCheckInAt: row ? Number(row.lastCheckInAt) : null,
  });
});

// Auto-generated GraphQL over the same tables, useful for ad-hoc queries.
app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

// Read-only SQL over HTTP (@ponder/client), if a client wants live queries.
app.use("/sql/*", client({ db, schema }));

export default app;
