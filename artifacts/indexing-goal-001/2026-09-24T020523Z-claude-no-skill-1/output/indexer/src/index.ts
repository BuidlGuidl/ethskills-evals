import { ponder } from "ponder:registry";
import { checkIn, member, memberMonth } from "ponder:schema";

/** "YYYY-MM" (UTC) for a UTC day index. */
function monthOf(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 7);
}

/**
 * The only write in the system produces the only event in the system, so a single
 * handler builds every read model. Ponder replays this over all historical logs on
 * startup and then keeps applying it to new blocks.
 */
ponder.on("Streak:CheckedIn", async ({ event, context }) => {
  const address = event.args.member;
  const day = Number(event.args.day);
  const streak = Number(event.args.streak);
  const total = Number(event.args.total);
  const note = event.args.note;
  const month = monthOf(day);
  const timestamp = Number(event.block.timestamp);

  await context.db.insert(checkIn).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    member: address,
    day,
    month,
    note,
    timestamp,
    blockNumber: event.block.number,
    logIndex: event.log.logIndex,
    transactionHash: event.transaction.hash,
    streak,
    memberTotal: total,
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
      longestStreak: Math.max(row.longestStreak, streak),
      lastDay: day,
      lastCheckInAt: timestamp,
      lastNote: note,
    }));

  await context.db
    .insert(memberMonth)
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
