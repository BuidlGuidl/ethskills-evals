import { ponder } from "ponder:registry";
import { checkIn, member, memberMonth } from "ponder:schema";
import { monthKey } from "./time";

/**
 * One handler, one event. Ponder replays every CheckedIn log from the
 * contract's deployment block forward, in order, then keeps going live — so
 * these rollups are always over the complete history.
 */
ponder.on("Streak:CheckedIn", async ({ event, context }) => {
  const { member: address, day, streak, total, note } = event.args;
  const timestamp = event.block.timestamp;
  const month = monthKey(timestamp);

  // 1. Append to the immutable record that backs the feed.
  await context.db.insert(checkIn).values({
    id: `${event.block.number}-${event.log.logIndex}`,
    member: address,
    day,
    month,
    timestamp,
    note,
    streak,
    total,
    blockNumber: event.block.number,
    logIndex: event.log.logIndex,
    transactionHash: event.transaction.hash,
  });

  // 2. Roll up the member's all-time counters.
  //    `streak` and `total` come straight from the contract, which already did
  //    the consecutive-day arithmetic; we only have to track the maximum.
  await context.db
    .insert(member)
    .values({
      address,
      total,
      streak,
      longestStreak: streak,
      lastDay: day,
      firstDay: day,
      firstCheckInAt: timestamp,
      lastCheckInAt: timestamp,
      lastNote: note,
    })
    .onConflictDoUpdate((row) => ({
      total,
      streak,
      longestStreak: Math.max(row.longestStreak, streak),
      lastDay: day,
      lastCheckInAt: timestamp,
      lastNote: note,
    }));

  // 3. Bump this month's counter for the leaderboard.
  await context.db
    .insert(memberMonth)
    .values({
      member: address,
      month,
      checkIns: 1,
      firstCheckInAt: timestamp,
      lastCheckInAt: timestamp,
    })
    .onConflictDoUpdate((row) => ({
      checkIns: row.checkIns + 1,
      lastCheckInAt: timestamp,
    }));
});
