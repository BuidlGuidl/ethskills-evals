import { index, onchainTable } from "ponder";

/**
 * One row per CheckedIn log, from the contract's first block onwards.
 * Backs the global feed; `(blockNumber, logIndex)` is the newest-first sort key
 * and the pagination cursor.
 */
export const checkIn = onchainTable(
  "check_in",
  (t) => ({
    id: t.text().primaryKey(), // `${txHash}-${logIndex}`
    member: t.hex().notNull(),
    day: t.integer().notNull(), // UTC day index (timestamp / 86400)
    month: t.text().notNull(), // "YYYY-MM" (UTC), the leaderboard bucket
    note: t.text().notNull(),
    timestamp: t.integer().notNull(), // block timestamp, seconds
    blockNumber: t.bigint().notNull(),
    logIndex: t.integer().notNull(),
    transactionHash: t.hex().notNull(),
    streak: t.integer().notNull(), // streak as of this check-in
    memberTotal: t.integer().notNull(), // member's all-time total as of this check-in
  }),
  (table) => ({
    feedIdx: index().on(table.blockNumber, table.logIndex),
    memberIdx: index().on(table.member, table.day),
    monthIdx: index().on(table.month),
  }),
);

/** Running per-member aggregate. Backs the profile screen. */
export const member = onchainTable("member", (t) => ({
  address: t.hex().primaryKey(),
  totalCheckIns: t.integer().notNull(),
  /** Streak as of `lastDay`. The API decays this to 0 if `lastDay` is older than yesterday. */
  streakAtLastCheckIn: t.integer().notNull(),
  longestStreak: t.integer().notNull(),
  firstDay: t.integer().notNull(),
  lastDay: t.integer().notNull(),
  firstCheckInAt: t.integer().notNull(),
  lastCheckInAt: t.integer().notNull(),
  lastNote: t.text().notNull(),
}));

/** Per-member, per-calendar-month counters. Backs the leaderboard. */
export const memberMonth = onchainTable(
  "member_month",
  (t) => ({
    id: t.text().primaryKey(), // `${address}-${YYYY-MM}`
    member: t.hex().notNull(),
    month: t.text().notNull(),
    checkIns: t.integer().notNull(),
    lastCheckInAt: t.integer().notNull(),
  }),
  (table) => ({
    rankIdx: index().on(table.month, table.checkIns),
  }),
);
