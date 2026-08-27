import { ponder } from "ponder:registry";
import { checkIn, member, memberMonth } from "ponder:schema";

/**
 * One handler, one event. Every field written here comes off the log itself —
 * no `eth_call` back into the contract — so the backfill runs at the speed of
 * `eth_getLogs` and the whole history (months of it, before launch) lands in
 * Postgres in a single pass.
 */
ponder.on("Streak:CheckedIn", async ({ event, context }) => {
  const { member: address, day, month, timestamp, streak, total, note } = event.args;

  // Monotonic feed cursor. 1e6 leaves plenty of room for logIndex within a block.
  const seq = event.block.number * 1_000_000n + BigInt(event.log.logIndex);

  await context.db.insert(checkIn).values({
    id: `${event.block.number}-${event.log.logIndex}`,
    seq,
    member: address,
    note,
    day,
    month,
    timestamp,
    streak,
    total,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });

  await context.db
    .insert(member)
    .values({
      address,
      totalCheckIns: total,
      streakAtLastCheckIn: streak,
      longestStreak: streak,
      firstDay: day,
      lastDay: day,
      firstCheckInAt: timestamp,
      lastCheckInAt: timestamp,
      lastNote: note,
    })
    .onConflictDoUpdate((row) => ({
      totalCheckIns: total,
      streakAtLastCheckIn: streak,
      longestStreak: streak > row.longestStreak ? streak : row.longestStreak,
      lastDay: day,
      lastCheckInAt: timestamp,
      lastNote: note,
    }));

  await context.db
    .insert(memberMonth)
    .values({
      member: address,
      month,
      checkIns: 1,
      bestStreak: streak,
      lastCheckInAt: timestamp,
    })
    .onConflictDoUpdate((row) => ({
      checkIns: row.checkIns + 1,
      bestStreak: streak > row.bestStreak ? streak : row.bestStreak,
      lastCheckInAt: timestamp,
    }));
});
