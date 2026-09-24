import { index, onchainTable, primaryKey } from "ponder";

/**
 * One row per `CheckedIn` event, for all time. This table is the global feed and
 * the source every other table is derived from.
 */
export const checkIn = onchainTable(
  "check_in",
  (t) => ({
    // `${blockNumber}-${logIndex}`, zero padded so string order == chain order.
    id: t.text().primaryKey(),
    member: t.hex().notNull(),
    /** UTC day index (unix seconds / 86400). */
    day: t.integer().notNull(),
    /** UTC month bucket as YYYYMM, e.g. 202609. */
    month: t.integer().notNull(),
    timestamp: t.bigint().notNull(),
    note: t.text().notNull(),
    /** The member's streak length including this check-in (as emitted). */
    streak: t.integer().notNull(),
    /** The member's all-time total including this check-in (as emitted). */
    memberTotal: t.integer().notNull(),
    blockNumber: t.bigint().notNull(),
    logIndex: t.integer().notNull(),
    transactionHash: t.hex().notNull(),
  }),
  (t) => ({
    // Global feed, newest first.
    feedIdx: index().on(t.blockNumber, t.logIndex),
    // A member's own history, newest first.
    memberIdx: index().on(t.member, t.blockNumber, t.logIndex),
    // Month scoped queries.
    monthIdx: index().on(t.month, t.blockNumber),
  }),
);

/**
 * Rolling per-member aggregate. Mirrors the contract's own member struct, so a
 * profile screen is a single row read instead of a scan over months of events.
 */
export const member = onchainTable(
  "member",
  (t) => ({
    address: t.hex().primaryKey(),
    firstDay: t.integer().notNull(),
    lastDay: t.integer().notNull(),
    lastCheckInAt: t.bigint().notNull(),
    lastNote: t.text().notNull(),
    /**
     * Streak as of `lastDay`. Like the contract's stored value this goes stale:
     * the API compares `lastDay` against today before reporting it.
     */
    streakAsOfLastDay: t.integer().notNull(),
    longestStreak: t.integer().notNull(),
    totalCheckIns: t.integer().notNull(),
  }),
  (t) => ({
    totalIdx: index().on(t.totalCheckIns),
    longestIdx: index().on(t.longestStreak),
  }),
);

/**
 * Per-member, per-month counters. The leaderboard reads one indexed slice of
 * this table; nothing has to be recomputed at request time.
 */
export const memberMonth = onchainTable(
  "member_month",
  (t) => ({
    member: t.hex().notNull(),
    /** UTC month bucket as YYYYMM. */
    month: t.integer().notNull(),
    checkIns: t.integer().notNull(),
    firstCheckInAt: t.bigint().notNull(),
    lastCheckInAt: t.bigint().notNull(),
    /** Best streak reached during this month (for display next to the count). */
    bestStreakInMonth: t.integer().notNull(),
  }),
  (t) => ({
    pk: primaryKey({ columns: [t.member, t.month] }),
    leaderboardIdx: index().on(t.month, t.checkIns),
  }),
);

/**
 * Per-day, per-member rows. Cheap "did they check in on day N" lookups, used to
 * render a profile's activity calendar and to verify streaks against raw days.
 */
export const dayActivity = onchainTable(
  "day_activity",
  (t) => ({
    member: t.hex().notNull(),
    day: t.integer().notNull(),
    timestamp: t.bigint().notNull(),
    note: t.text().notNull(),
  }),
  (t) => ({
    pk: primaryKey({ columns: [t.member, t.day] }),
    dayIdx: index().on(t.day),
  }),
);

/** Community-wide counters, single row keyed `"global"`. */
export const stats = onchainTable("stats", (t) => ({
  id: t.text().primaryKey(),
  totalCheckIns: t.integer().notNull(),
  totalMembers: t.integer().notNull(),
  firstDay: t.integer().notNull(),
  lastDay: t.integer().notNull(),
  lastCheckInAt: t.bigint().notNull(),
}));
