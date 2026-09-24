import { index, onchainTable, primaryKey, relations } from "ponder";

/**
 * One row per check-in: the raw, append-only history. Backs the global feed.
 */
export const checkIn = onchainTable(
  "check_in",
  (t) => ({
    // `${blockNumber}-${logIndex}`, zero-padded so lexical order == chain order.
    // Doubles as the feed's keyset-pagination cursor.
    id: t.text().primaryKey(),
    member: t.hex().notNull(),
    // UTC day index (unix seconds / 86400), straight from the event.
    day: t.integer().notNull(),
    timestamp: t.integer().notNull(),
    note: t.text().notNull(),
    // The member's streak and all-time total *as of* this check-in, so a feed row
    // can show "day 12 of their streak" without a second query.
    streakAtCheckIn: t.integer().notNull(),
    totalAtCheckIn: t.integer().notNull(),
    blockNumber: t.bigint().notNull(),
    logIndex: t.integer().notNull(),
    transactionHash: t.hex().notNull(),
  }),
  (table) => ({
    // Global feed, newest first.
    feedIdx: index().on(table.id),
    // Profile timeline for one member, newest first.
    memberIdx: index().on(table.member, table.id),
  }),
);

/**
 * One row per member: the rolled-up profile. Backs the profile screen.
 */
export const member = onchainTable(
  "member",
  (t) => ({
    address: t.hex().primaryKey(),
    totalCheckIns: t.integer().notNull(),
    // Streak as recorded at `lastDay`. This value goes stale: once the member
    // misses a day it is no longer their live streak. The API applies the decay
    // rule (see `liveStreak` in src/lib/streak.ts) before serving it.
    streakAtLastDay: t.integer().notNull(),
    longestStreak: t.integer().notNull(),
    firstDay: t.integer().notNull(),
    lastDay: t.integer().notNull(),
    firstCheckInAt: t.integer().notNull(),
    lastCheckInAt: t.integer().notNull(),
    lastNote: t.text().notNull(),
  }),
  (table) => ({
    totalIdx: index().on(table.totalCheckIns),
  }),
);

/**
 * Per-member, per-calendar-month check-in counts. Backs the leaderboard.
 *
 * Kept as its own table rather than computed at query time: aggregating over the
 * whole `check_in` history on every leaderboard page load gets slower every month,
 * whereas this is a single indexed range scan.
 */
export const memberMonth = onchainTable(
  "member_month",
  (t) => ({
    // `YYYY-MM` in UTC.
    month: t.text().notNull(),
    member: t.hex().notNull(),
    checkIns: t.integer().notNull(),
    // Longest run of consecutive days that falls inside this month, for tie-breaks.
    bestStreakInMonth: t.integer().notNull(),
    lastCheckInAt: t.integer().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.month, table.member] }),
    // Leaderboard: filter on month, order by count desc.
    rankIdx: index().on(table.month, table.checkIns),
  }),
);

/**
 * Single-row global counters, so the UI can show community totals without a
 * COUNT(*) over the full history.
 */
export const stats = onchainTable("stats", (t) => ({
  id: t.text().primaryKey(), // always "global"
  totalCheckIns: t.integer().notNull(),
  totalMembers: t.integer().notNull(),
  firstDay: t.integer().notNull(),
  lastDay: t.integer().notNull(),
}));

export const checkInRelations = relations(checkIn, ({ one }) => ({
  memberRecord: one(member, {
    fields: [checkIn.member],
    references: [member.address],
  }),
}));

export const memberRelations = relations(member, ({ many }) => ({
  checkIns: many(checkIn),
  months: many(memberMonth),
}));

export const memberMonthRelations = relations(memberMonth, ({ one }) => ({
  memberRecord: one(member, {
    fields: [memberMonth.member],
    references: [member.address],
  }),
}));
