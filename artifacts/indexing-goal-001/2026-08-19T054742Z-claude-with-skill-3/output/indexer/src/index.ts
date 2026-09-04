import { ponder } from "ponder:registry";
import { checkIn, member, memberMonth } from "ponder:schema";

import { monthFromDay } from "./time";

/**
 * The whole read side is built from this one event. Ponder replays it from the
 * contract's deployment block through the chain tip on first run, then keeps
 * applying it live, so every table below reflects complete history.
 */
ponder.on("Streak:CheckedIn", async ({ event, context }) => {
  const { member: address, day, streak, memberTotal, note } = event.args;
  const timestamp = Number(event.block.timestamp);
  const month = monthFromDay(day);
  const ordinal = (event.block.number << 16n) | BigInt(event.log.logIndex);

  await context.db.insert(checkIn).values({
    id: `${event.block.number}-${event.log.logIndex}`,
    ordinal,
    member: address,
    note,
    day,
    month,
    streak,
    memberTotal,
    timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });

  await context.db
    .insert(member)
    .values({
      address,
      totalCheckIns: memberTotal,
      streakAtLastDay: streak,
      longestStreak: streak,
      firstDay: day,
      lastDay: day,
      firstCheckInAt: timestamp,
      lastCheckInAt: timestamp,
    })
    .onConflictDoUpdate((row) => ({
      totalCheckIns: memberTotal,
      streakAtLastDay: streak,
      longestStreak: Math.max(row.longestStreak, streak),
      lastDay: day,
      lastCheckInAt: timestamp,
    }));

  await context.db
    .insert(memberMonth)
    .values({
      month,
      member: address,
      checkIns: 1,
      lastCheckInAt: timestamp,
    })
    .onConflictDoUpdate((row) => ({
      checkIns: row.checkIns + 1,
      lastCheckInAt: timestamp,
    }));
});
