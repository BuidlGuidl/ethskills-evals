import { index, onchainTable, primaryKey } from "ponder";

/**
 * One row per `CheckedIn` event, for the global feed and a member's note history.
 *
 * `ordinal` is a single monotonically increasing sort key (blockNumber << 16 |
 * logIndex) so the feed can paginate newest-first with a keyset cursor instead of
 * an OFFSET that drifts as new check-ins arrive.
 */
export const checkIn = onchainTable(
  "check_in",
  (t) => ({
    id: t.text().primaryKey(), // `${blockNumber}-${logIndex}`
    ordinal: t.bigint().notNull(),
    member: t.hex().notNull(),
    note: t.text().notNull(),
    day: t.integer().notNull(), // UTC day index (unix / 86400)
    month: t.text().notNull(), // "YYYY-MM", UTC
    streak: t.integer().notNull(), // streak including this check-in
    memberTotal: t.integer().notNull(), // member's all-time total including this one
    timestamp: t.integer().notNull(), // block timestamp, seconds
    blockNumber: t.bigint().notNull(),
    transactionHash: t.hex().notNull(),
  }),
  (table) => ({
    feedIdx: index().on(table.ordinal),
    memberIdx: index().on(table.member, table.ordinal),
  }),
);

/** Per-member rollup: the profile screen's numbers, derived from full history. */
export const member = onchainTable("member", (t) => ({
  address: t.hex().primaryKey(),
  totalCheckIns: t.integer().notNull(),
  /** Streak as of `lastDay`. Dead unless `lastDay` is today or yesterday -- the
   *  API applies that rule at read time (see `liveStreak`). */
  streakAtLastDay: t.integer().notNull(),
  longestStreak: t.integer().notNull(),
  firstDay: t.integer().notNull(),
  lastDay: t.integer().notNull(),
  firstCheckInAt: t.integer().notNull(),
  lastCheckInAt: t.integer().notNull(),
}));

/** Per-member, per-month counts. The leaderboard is a single indexed read here. */
export const memberMonth = onchainTable(
  "member_month",
  (t) => ({
    month: t.text().notNull(), // "YYYY-MM", UTC
    member: t.hex().notNull(),
    checkIns: t.integer().notNull(),
    lastCheckInAt: t.integer().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.month, table.member] }),
    rankIdx: index().on(table.month, table.checkIns),
  }),
);
