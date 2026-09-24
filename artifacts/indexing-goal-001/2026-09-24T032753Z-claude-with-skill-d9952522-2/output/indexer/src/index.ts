import { ponder } from "ponder:registry";
import { checkIn, member, memberMonth, stats } from "ponder:schema";
import {
  checkInId,
  dayOfMonth,
  monthKey,
} from "./lib/streak";

/**
 * The single event handler. Ponder replays every `CheckedIn` log from the
 * contract's deployment block forward, so these writes reconstruct the complete
 * history on first run, then keep it current as new blocks arrive.
 *
 * Nothing here reads from the chain: the event carries the member's streak and
 * total, so the backfill is pure log processing with no per-event RPC calls.
 */
ponder.on("Streak:CheckedIn", async ({ event, context }) => {
  const { day, streak, total, isNewMember, note } = event.args;
  // Normalise case so the API can look members up by a lowercased address.
  const address = event.args.member.toLowerCase() as `0x${string}`;
  const timestamp = Number(event.block.timestamp);
  const month = monthKey(day);

  // 1. Append the raw check-in. Backs the global feed and per-member timeline.
  await context.db.insert(checkIn).values({
    id: checkInId(event.block.number, event.log.logIndex),
    member: address,
    day,
    timestamp,
    note,
    streakAtCheckIn: streak,
    totalAtCheckIn: total,
    blockNumber: event.block.number,
    logIndex: event.log.logIndex,
    transactionHash: event.transaction.hash,
  });

  // 2. Roll up the member profile.
  await context.db
    .insert(member)
    .values({
      address,
      totalCheckIns: total,
      streakAtLastDay: streak,
      longestStreak: streak,
      firstDay: day,
      lastDay: day,
      firstCheckInAt: timestamp,
      lastCheckInAt: timestamp,
      lastNote: note,
    })
    .onConflictDoUpdate((row) => ({
      totalCheckIns: total,
      streakAtLastDay: streak,
      longestStreak: Math.max(row.longestStreak, streak),
      lastDay: day,
      lastCheckInAt: timestamp,
      lastNote: note,
    }));

  // 3. Bump this member's counter for the calendar month. The leaderboard reads
  //    this table directly instead of aggregating the whole history per request.
  //
  //    A streak can span a month boundary, so only the portion of the run that
  //    falls inside this month counts: a run ending on the Nth of the month is at
  //    most N days long within it.
  const streakThisMonth = Math.min(streak, dayOfMonth(day));
  await context.db
    .insert(memberMonth)
    .values({
      month,
      member: address,
      checkIns: 1,
      bestStreakInMonth: streakThisMonth,
      lastCheckInAt: timestamp,
    })
    .onConflictDoUpdate((row) => ({
      checkIns: row.checkIns + 1,
      bestStreakInMonth: Math.max(row.bestStreakInMonth, streakThisMonth),
      lastCheckInAt: timestamp,
    }));

  // 4. Global counters.
  await context.db
    .insert(stats)
    .values({
      id: "global",
      totalCheckIns: 1,
      totalMembers: 1,
      firstDay: day,
      lastDay: day,
    })
    .onConflictDoUpdate((row) => ({
      totalCheckIns: row.totalCheckIns + 1,
      totalMembers: row.totalMembers + (isNewMember ? 1 : 0),
      lastDay: day,
    }));
});
