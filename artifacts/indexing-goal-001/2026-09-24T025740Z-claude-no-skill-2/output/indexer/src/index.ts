import { ponder } from "ponder:registry";
import schema from "ponder:schema";

import { monthFromTimestamp } from "./lib/time";

/** Zero padded so `id` sorts in chain order as plain text. */
function checkInId(blockNumber: bigint, logIndex: number): string {
  return `${blockNumber.toString().padStart(12, "0")}-${logIndex.toString().padStart(6, "0")}`;
}

/**
 * The only indexing function in the app: every screen is derived from this one
 * event. Ponder replays it over the contract's entire history on first run and
 * then keeps applying it to new blocks, so the tables always describe the full
 * record rather than a window.
 */
ponder.on("Streak:CheckedIn", async ({ event, context }) => {
  const { member: address, day, timestamp, streak, total, note } = event.args;
  const month = monthFromTimestamp(timestamp);

  await context.db.insert(schema.checkIn).values({
    id: checkInId(event.block.number, event.log.logIndex),
    member: address,
    day,
    month,
    timestamp,
    note,
    streak,
    memberTotal: total,
    blockNumber: event.block.number,
    logIndex: event.log.logIndex,
    transactionHash: event.transaction.hash,
  });

  await context.db
    .insert(schema.member)
    .values({
      address,
      firstDay: day,
      lastDay: day,
      lastCheckInAt: timestamp,
      lastNote: note,
      streakAsOfLastDay: streak,
      longestStreak: streak,
      totalCheckIns: total,
    })
    .onConflictDoUpdate((row) => ({
      lastDay: day,
      lastCheckInAt: timestamp,
      lastNote: note,
      streakAsOfLastDay: streak,
      longestStreak: Math.max(row.longestStreak, streak),
      totalCheckIns: total,
    }));

  await context.db
    .insert(schema.memberMonth)
    .values({
      member: address,
      month,
      checkIns: 1,
      firstCheckInAt: timestamp,
      lastCheckInAt: timestamp,
      bestStreakInMonth: streak,
    })
    .onConflictDoUpdate((row) => ({
      checkIns: row.checkIns + 1,
      lastCheckInAt: timestamp,
      bestStreakInMonth: Math.max(row.bestStreakInMonth, streak),
    }));

  // The contract already rejects a second check-in on the same day, so this
  // insert cannot conflict — but reorg-safe replays are cheaper than a crash.
  await context.db
    .insert(schema.dayActivity)
    .values({ member: address, day, timestamp, note })
    .onConflictDoNothing();

  await context.db
    .insert(schema.stats)
    .values({
      id: "global",
      totalCheckIns: 1,
      totalMembers: 1,
      firstDay: day,
      lastDay: day,
      lastCheckInAt: timestamp,
    })
    .onConflictDoUpdate((row) => ({
      totalCheckIns: row.totalCheckIns + 1,
      // `total === 1` means this address had never checked in before.
      totalMembers: total === 1 ? row.totalMembers + 1 : row.totalMembers,
      lastDay: day,
      lastCheckInAt: timestamp,
    }));
});
