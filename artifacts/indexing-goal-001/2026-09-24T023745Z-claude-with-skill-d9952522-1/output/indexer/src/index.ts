import { ponder } from "ponder:registry";
import { checkIn, dayStat, globalStat, member, memberMonth } from "ponder:schema";
import { monthOf } from "./days";

const GLOBAL = "streak";

/**
 * The entire read side is built from `CheckedIn`.
 *
 * The event carries the member's post-check-in streak and total, so nothing here
 * has to call the contract or reason about ordering: each event is applied once,
 * in chain order, during both the historical backfill and the realtime tail.
 */
ponder.on("Streak:CheckedIn", async ({ event, context }) => {
  const address = event.args.member;
  const day = Number(event.args.day);
  const month = monthOf(day);
  const timestamp = Number(event.block.timestamp);
  const streak = Number(event.args.currentStreak);
  const total = Number(event.args.totalCheckIns);
  const note = event.args.note;

  // Blocks hold at most a few thousand logs, so 16 bits of log index is ample
  // headroom and keeps this strictly increasing across the whole chain.
  const ordinal = (event.block.number << 16n) | BigInt(event.log.logIndex);

  await context.db.insert(checkIn).values({
    id: `${event.block.number}-${event.log.logIndex}`,
    ordinal,
    member: address,
    day,
    month,
    timestamp,
    note,
    streakAfter: streak,
    totalAfter: total,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });

  await context.db
    .insert(member)
    .values({
      address,
      firstDay: day,
      firstCheckInAt: timestamp,
      lastDay: day,
      lastCheckInAt: timestamp,
      lastNote: note,
      currentStreak: streak,
      longestStreak: streak,
      totalCheckIns: total,
    })
    // MemberJoined fires in the same transaction and may be processed first, so
    // the row can already exist; only the "first" fields must be preserved.
    .onConflictDoUpdate((row) => ({
      lastDay: day,
      lastCheckInAt: timestamp,
      lastNote: note,
      currentStreak: streak,
      longestStreak: Math.max(row.longestStreak, streak),
      totalCheckIns: total,
      firstDay: row.firstDay === 0 ? day : row.firstDay,
      firstCheckInAt: row.firstCheckInAt === 0 ? timestamp : row.firstCheckInAt,
    }));

  await context.db
    .insert(memberMonth)
    .values({ member: address, month, checkIns: 1, bestStreak: streak, lastCheckInAt: timestamp })
    .onConflictDoUpdate((row) => ({
      checkIns: row.checkIns + 1,
      bestStreak: Math.max(row.bestStreak, streak),
      lastCheckInAt: timestamp,
    }));

  await context.db
    .insert(dayStat)
    .values({ day, month, checkIns: 1, newMembers: 0 })
    .onConflictDoUpdate((row) => ({ checkIns: row.checkIns + 1 }));

  await context.db
    .insert(globalStat)
    .values({ id: GLOBAL, totalCheckIns: 1, totalMembers: 0, firstDay: day, lastDay: day })
    .onConflictDoUpdate((row) => ({
      totalCheckIns: row.totalCheckIns + 1,
      lastDay: day,
    }));
});

/**
 * `MemberJoined` only fires on an address's first ever check-in, which is
 * exactly the "new members today" and "total members" signal — deriving it from
 * check-ins would mean counting distinct addresses at read time.
 */
ponder.on("Streak:MemberJoined", async ({ event, context }) => {
  const day = Number(event.args.day);
  const timestamp = Number(event.block.timestamp);

  await context.db
    .insert(member)
    .values({
      address: event.args.member,
      firstDay: day,
      firstCheckInAt: timestamp,
      lastDay: day,
      lastCheckInAt: timestamp,
      lastNote: "",
      currentStreak: 1,
      longestStreak: 1,
      totalCheckIns: 1,
    })
    .onConflictDoUpdate((row) => ({
      firstDay: row.firstDay === 0 ? day : Math.min(row.firstDay, day),
      firstCheckInAt: row.firstCheckInAt === 0 ? timestamp : Math.min(row.firstCheckInAt, timestamp),
    }));

  await context.db
    .insert(dayStat)
    .values({ day, month: monthOf(day), checkIns: 0, newMembers: 1 })
    .onConflictDoUpdate((row) => ({ newMembers: row.newMembers + 1 }));

  await context.db
    .insert(globalStat)
    .values({ id: GLOBAL, totalCheckIns: 0, totalMembers: 1, firstDay: day, lastDay: day })
    .onConflictDoUpdate((row) => ({ totalMembers: row.totalMembers + 1 }));
});

/** Personal bests, kept accurate even if a re-org replays events out of order. */
ponder.on("Streak:StreakRecord", async ({ event, context }) => {
  const length = Number(event.args.length);
  await context.db
    .insert(member)
    .values({
      address: event.args.member,
      firstDay: 0,
      firstCheckInAt: 0,
      lastDay: Number(event.args.day),
      lastCheckInAt: Number(event.block.timestamp),
      lastNote: "",
      currentStreak: length,
      longestStreak: length,
      totalCheckIns: 0,
    })
    .onConflictDoUpdate((row) => ({
      longestStreak: Math.max(row.longestStreak, length),
    }));
});
