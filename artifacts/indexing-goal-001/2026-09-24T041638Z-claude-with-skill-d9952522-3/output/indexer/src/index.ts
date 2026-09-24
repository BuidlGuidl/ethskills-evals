import { ponder } from "ponder:registry";
import { checkIn, member, memberMonth, stats } from "ponder:schema";
import { monthKey } from "./util/time";

const GLOBAL = "global";

// The only event the contract emits, and the only handler the read side needs.
// Ponder replays every one of these from the deploy block on first run
// (the backfill), then follows the chain head.
ponder.on("Streak:CheckedIn", async ({ event, context }) => {
  const { member: address, day, streak, total, isNewMember, note } = event.args;
  const timestamp = Number(event.block.timestamp);
  const month = monthKey(timestamp);
  const seq = event.block.number * 1_000_000n + BigInt(event.log.logIndex);

  await context.db.insert(checkIn).values({
    seq,
    member: address,
    note,
    day,
    month,
    streak,
    memberTotal: total,
    timestamp,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });

  await context.db
    .insert(member)
    .values({
      address,
      total,
      longestStreak: streak,
      streakAtLastDay: streak,
      firstDay: day,
      lastDay: day,
      firstCheckInAt: timestamp,
      lastCheckInAt: timestamp,
      lastNote: note,
    })
    .onConflictDoUpdate((row) => ({
      total,
      longestStreak: Math.max(row.longestStreak, streak),
      streakAtLastDay: streak,
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
      lastCheckInAt: timestamp,
      longestStreakInMonth: streak,
    })
    .onConflictDoUpdate((row) => ({
      checkIns: row.checkIns + 1,
      lastCheckInAt: timestamp,
      longestStreakInMonth: Math.max(row.longestStreakInMonth, streak),
    }));

  await context.db
    .insert(stats)
    .values({
      id: GLOBAL,
      totalCheckIns: 1,
      totalMembers: isNewMember ? 1 : 0,
      lastCheckInAt: timestamp,
    })
    .onConflictDoUpdate((row) => ({
      totalCheckIns: row.totalCheckIns + 1,
      totalMembers: row.totalMembers + (isNewMember ? 1 : 0),
      lastCheckInAt: timestamp,
    }));
});
