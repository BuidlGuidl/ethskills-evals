import { ponder } from "ponder:registry";
import schema from "ponder:schema";
import { monthOf, sortKey } from "./lib/keys.ts";

/**
 * Indexing function for the one and only write in the app.
 *
 * Ponder calls this once per `CheckedIn` log, in chain order, starting at the
 * contract's deployment block. The historical backfill and live tail run through
 * exactly this code, so a member's streak is built the same way whether their
 * check-in happened four months ago or thirty seconds ago.
 *
 * The contract already computes `streak` and `total` and puts them in the event,
 * so this is a projection rather than a re-derivation — no risk of the indexer
 * and the chain disagreeing about someone's streak.
 */
ponder.on("Streak:CheckedIn", async ({ event, context }) => {
  const { member, day, timestamp, streak, total, note } = event.args;

  const at = Number(timestamp);
  const dayIndex = Number(day);
  const month = monthOf(at);
  const streakNow = Number(streak);
  const totalNow = Number(total);
  // viem hands back checksummed addresses; `hex()` columns store them lowercased,
  // so lowercase here too and keep the composite key consistent with the column.
  const address = member.toLowerCase() as `0x${string}`;

  await context.db.insert(schema.checkIn).values({
    id: sortKey(event.block.number, event.log.logIndex),
    member,
    day: dayIndex,
    timestamp: at,
    month,
    note,
    streak: streakNow,
    memberTotal: totalNow,
    blockNumber: event.block.number,
    logIndex: event.log.logIndex,
    transactionHash: event.transaction.hash,
  });

  await context.db
    .insert(schema.member)
    .values({
      address: member,
      totalCheckIns: totalNow,
      streakAsOfLastDay: streakNow,
      longestStreak: streakNow,
      lastDay: dayIndex,
      firstCheckInAt: at,
      lastCheckInAt: at,
      lastNote: note,
    })
    .onConflictDoUpdate((row) => ({
      totalCheckIns: totalNow,
      streakAsOfLastDay: streakNow,
      longestStreak: Math.max(row.longestStreak, streakNow),
      lastDay: dayIndex,
      lastCheckInAt: at,
      lastNote: note,
    }));

  await context.db
    .insert(schema.memberMonth)
    .values({
      id: `${month}:${address}`,
      month,
      member,
      checkIns: 1,
      firstCheckInAt: at,
      lastCheckInAt: at,
    })
    .onConflictDoUpdate((row) => ({
      checkIns: row.checkIns + 1,
      lastCheckInAt: at,
    }));
});
