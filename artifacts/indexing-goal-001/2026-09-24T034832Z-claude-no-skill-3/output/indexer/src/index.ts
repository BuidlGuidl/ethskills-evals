import { ponder } from "ponder:registry";
import schema from "ponder:schema";
import { monthOfDay, seqOf } from "./lib/streak";

/**
 * The only write in the system is `checkIn`, so the only event we index is
 * `CheckedIn`. Ponder replays it from the contract's deployment block forward,
 * which is what makes the feed / profiles / leaderboard cover all of history
 * rather than just what happened while a page was open.
 *
 * The contract already computes the streak and the all-time total for each
 * check-in, so this handler never has to reason about ordering: it stores what
 * the event says and maintains the aggregates the three screens read.
 */
ponder.on("Streak:CheckedIn", async ({ event, context }) => {
  const { member, day, streak, total, note } = event.args;
  const timestamp = event.block.timestamp;
  const seq = seqOf(event.block.number, event.log.logIndex);
  // `day` comes from the contract; derive the month from it so both agree even
  // if a chain's block timestamps ever drift.
  const dayIndex = Number(day);
  const month = monthOfDay(dayIndex);

  await context.db.insert(schema.checkIn).values({
    id: `${event.block.number}-${event.log.logIndex}`,
    member,
    day: dayIndex,
    month,
    timestamp,
    streak: Number(streak),
    total: Number(total),
    note,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
    seq,
  });

  await context.db
    .insert(schema.member)
    .values({
      address: member,
      total: Number(total),
      streakAtLastCheckIn: Number(streak),
      longestStreak: Number(streak),
      firstDay: dayIndex,
      lastDay: dayIndex,
      firstCheckInAt: timestamp,
      lastCheckInAt: timestamp,
      lastNote: note,
    })
    .onConflictDoUpdate((row) => ({
      total: Number(total),
      streakAtLastCheckIn: Number(streak),
      longestStreak: Math.max(row.longestStreak, Number(streak)),
      lastDay: dayIndex,
      lastCheckInAt: timestamp,
      lastNote: note,
    }));

  await context.db
    .insert(schema.monthlyCount)
    .values({ member, month, count: 1, firstSeq: seq })
    .onConflictDoUpdate((row) => ({ count: row.count + 1 }));

  await context.db
    .insert(schema.dailyTotal)
    .values({ day: dayIndex, month, checkIns: 1 })
    .onConflictDoUpdate((row) => ({ checkIns: row.checkIns + 1 }));
});
