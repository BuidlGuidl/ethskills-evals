import { index, onchainTable, primaryKey } from "ponder";

/**
 * Three tables, one per screen:
 *   checkIn     -> the global feed (and a member's recent notes)
 *   member      -> the profile: all-time total, streak, longest streak
 *   memberMonth -> the monthly leaderboard, pre-aggregated per member per month
 *
 * `member` and `memberMonth` are rolled up as events are processed, so neither
 * the feed nor the leaderboard ever has to count rows across the full history.
 */

export const checkIn = onchainTable(
  "check_in",
  (t) => ({
    /** `${blockNumber}-${logIndex}`, unique per log. */
    id: t.text().primaryKey(),
    /**
     * Monotonic cursor: blockNumber * 1e6 + logIndex. Newest-first feed
     * pagination is `ORDER BY seq DESC` + `WHERE seq < cursor`, which stays
     * O(limit) no matter how many months of history are behind it.
     */
    seq: t.bigint().notNull(),
    member: t.hex().notNull(),
    note: t.text().notNull(),
    /** UTC day index (unix / 86400) of the check-in. */
    day: t.integer().notNull(),
    /** UTC month key, YYYYMM. */
    month: t.integer().notNull(),
    timestamp: t.bigint().notNull(),
    /** Streak including this check-in, as emitted by the contract. */
    streak: t.integer().notNull(),
    /** The member's all-time total including this check-in. */
    total: t.integer().notNull(),
    blockNumber: t.bigint().notNull(),
    transactionHash: t.hex().notNull(),
  }),
  (table) => ({
    seqIdx: index().on(table.seq),
    memberSeqIdx: index().on(table.member, table.seq),
  }),
);

export const member = onchainTable(
  "member",
  (t) => ({
    address: t.hex().primaryKey(),
    /** All-time check-ins. */
    totalCheckIns: t.integer().notNull().default(0),
    /**
     * Streak as of `lastDay`. This is NOT the live streak: it has to be decayed
     * to 0 once a full day has been missed. The API does that at read time
     * (see `liveStreak`), because the value changes with the wall clock and not
     * with any onchain event.
     */
    streakAtLastCheckIn: t.integer().notNull().default(0),
    longestStreak: t.integer().notNull().default(0),
    firstDay: t.integer().notNull(),
    lastDay: t.integer().notNull(),
    firstCheckInAt: t.bigint().notNull(),
    lastCheckInAt: t.bigint().notNull(),
    lastNote: t.text().notNull().default(""),
  }),
  (table) => ({
    totalIdx: index().on(table.totalCheckIns),
    longestIdx: index().on(table.longestStreak),
  }),
);

export const memberMonth = onchainTable(
  "member_month",
  (t) => ({
    member: t.hex().notNull(),
    /** UTC month key, YYYYMM. */
    month: t.integer().notNull(),
    checkIns: t.integer().notNull().default(0),
    /** Best streak reached during this month, for tie-breaking / display. */
    bestStreak: t.integer().notNull().default(0),
    lastCheckInAt: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.month, table.member] }),
    leaderboardIdx: index().on(table.month, table.checkIns),
  }),
);
