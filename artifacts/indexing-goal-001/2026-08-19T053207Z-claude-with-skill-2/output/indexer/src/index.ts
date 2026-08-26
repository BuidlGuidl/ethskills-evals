import { ponder } from "ponder:registry";
import schema from "ponder:schema";

import { checkInId, monthKey } from "./lib/time";

/**
 * Every screen in the app is built here, incrementally, as `CheckedIn` events
 * are indexed — once for the months of history that already exist on Base when
 * the app launches (the backfill), then continuously as new check-ins land.
 *
 * The contract guarantees at most one check-in per member per UTC day, so day
 * indices for a member arrive strictly increasing and the streak arithmetic
 * below never has to handle a duplicate or an out-of-order day.
 */
ponder.on("Streak:CheckedIn", async ({ event, context }) => {
  const address = event.args.member;
  const day = Number(event.args.day);
  const timestamp = Number(event.args.timestamp);
  const note = event.args.note;
  const month = monthKey(timestamp);

  // 1. The feed: the raw log, append-only.
  await context.db.insert(schema.checkIn).values({
    id: checkInId(event.block.number, event.log.logIndex),
    member: address,
    day,
    timestamp,
    note,
    month,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });

  // 2. The profile: streak + all-time total.
  await context.db
    .insert(schema.member)
    .values({
      address,
      totalCheckIns: 1,
      currentStreak: 1,
      longestStreak: 1,
      firstDay: day,
      lastDay: day,
      firstCheckInAt: timestamp,
      lastCheckInAt: timestamp,
      lastNote: note,
    })
    .onConflictDoUpdate((row) => {
      // Consecutive calendar days extend the streak; any gap restarts it at 1.
      const currentStreak = day === row.lastDay + 1 ? row.currentStreak + 1 : 1;
      return {
        totalCheckIns: row.totalCheckIns + 1,
        currentStreak,
        longestStreak: Math.max(row.longestStreak, currentStreak),
        lastDay: day,
        lastCheckInAt: timestamp,
        lastNote: note,
      };
    });

  // 3. The leaderboard: per-member count for this calendar month.
  await context.db
    .insert(schema.memberMonth)
    .values({
      id: `${address}-${month}`,
      member: address,
      month,
      checkIns: 1,
      lastCheckInAt: timestamp,
    })
    .onConflictDoUpdate((row) => ({
      checkIns: row.checkIns + 1,
      lastCheckInAt: timestamp,
    }));
});
