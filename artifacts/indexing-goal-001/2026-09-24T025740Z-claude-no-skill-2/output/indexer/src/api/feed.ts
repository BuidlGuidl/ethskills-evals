import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { and, asc, desc, eq, gt, lt } from "ponder";

import { clampLimit, normalizeAddress, serializeCheckIn } from "./shared";

const app = new Hono();

/**
 * GET /api/feed
 *
 * The global feed, newest first, over the contract's entire history.
 *
 *   ?limit=50            page size (max 100)
 *   ?cursor=<id>         keyset cursor: return items strictly older than this id
 *   ?member=0x..         restrict to one member (powers the profile timeline)
 *   ?since=<id>          instead of paging back, return items *newer* than this
 *                        id — what a live feed polls with the newest id it has
 *
 * `id` sorts in chain order (zero padded blockNumber-logIndex), so paging is a
 * keyset scan, not an OFFSET: page 40 costs the same as page 1.
 */
app.get("/feed", async (c) => {
  const limit = clampLimit(c.req.query("limit"), 50, 100);
  const cursor = c.req.query("cursor");
  const since = c.req.query("since");

  const memberParam = c.req.query("member");
  let member: `0x${string}` | null = null;
  if (memberParam !== undefined) {
    member = normalizeAddress(memberParam);
    if (member === null) return c.json({ error: "invalid member address" }, 400);
  }

  const filters = [
    member ? eq(schema.checkIn.member, member) : undefined,
    cursor ? lt(schema.checkIn.id, cursor) : undefined,
    since ? gt(schema.checkIn.id, since) : undefined,
  ].filter((f) => f !== undefined);

  const where = filters.length > 0 ? and(...filters) : undefined;

  // For `since` we take the *oldest* unseen items first so that a poller that
  // fell behind receives a contiguous run, then present them newest first.
  const rows = await db
    .select()
    .from(schema.checkIn)
    .where(where)
    .orderBy(since ? asc(schema.checkIn.id) : desc(schema.checkIn.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  if (since) page.reverse();

  const items = page.map(serializeCheckIn);

  return c.json({
    items,
    // Pass back as ?cursor= to load older items. Null when the history is
    // exhausted — that end really is the contract's first ever check-in.
    nextCursor: !since && hasMore ? (items.at(-1)?.id ?? null) : null,
    // Pass back as ?since= to poll for newer items.
    latestCursor: items[0]?.id ?? cursor ?? since ?? null,
    hasMore,
  });
});

export default app;
