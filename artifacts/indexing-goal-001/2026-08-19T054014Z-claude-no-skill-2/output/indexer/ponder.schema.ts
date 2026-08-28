import { index, onchainTable, primaryKey } from "ponder";

/**
 * The read model behind the three screens.
 *
 * `checkIn` is the log-for-log record of history; `member` and `memberMonth`
 * are rollups maintained incrementally as each log is indexed, so the profile
 * and leaderboard screens never have to scan the whole history at request time.
 */

/** One row per CheckedIn log, ever. Backs the global feed. */
export const checkIn = onchainTable(
  "check_in",
  (t) => ({
    /** `${blockNumber}-${logIndex}`, unique and stable across reorgs. */
    id: t.text().primaryKey(),
    member: t.hex().notNull(),
    /** UTC day index (unix seconds / 86400) the check-in counted for. */
    day: t.integer().notNull(),
    /** UTC month, "YYYY-MM", denormalised so month queries stay index-only. */
    month: t.text().notNull(),
    /** Block timestamp, unix seconds. */
    timestamp: t.bigint().notNull(),
    note: t.text().notNull(),
    /** The member's streak as of this check-in, straight from the event. */
    streak: t.integer().notNull(),
    /** The member's all-time total as of this check-in. */
    total: t.integer().notNull(),
    blockNumber: t.bigint().notNull(),
    logIndex: t.integer().notNull(),
    transactionHash: t.hex().notNull(),
  }),
  (table) => ({
    // Feed: newest first, paginated on the (blockNumber, logIndex) cursor.
    feedIdx: index().on(table.blockNumber, table.logIndex),
    // A single member's history, newest first.
    memberIdx: index().on(table.member, table.blockNumber, table.logIndex),
  }),
);

/** All-time rollup per member. Backs the profile screen. */
export const member = onchainTable(
  "member",
  (t) => ({
    address: t.hex().primaryKey(),
    /** All-time number of check-ins. */
    total: t.integer().notNull(),
    /**
     * Streak as of the member's last check-in. Whether it is still *alive*
     * depends on today's date, so the API applies the lapse rule at read time.
     */
    streak: t.integer().notNull(),
    /** Longest run of consecutive days the member has ever put together. */
    longestStreak: t.integer().notNull(),
    /** UTC day index of the most recent check-in. */
    lastDay: t.integer().notNull(),
    /** UTC day index of the first check-in. */
    firstDay: t.integer().notNull(),
    firstCheckInAt: t.bigint().notNull(),
    lastCheckInAt: t.bigint().notNull(),
    /** Most recent note, handy for rendering a profile header. */
    lastNote: t.text().notNull(),
  }),
  (table) => ({
    totalIdx: index().on(table.total),
  }),
);

/** Per-member, per-month counter. Backs the leaderboard screen. */
export const memberMonth = onchainTable(
  "member_month",
  (t) => ({
    member: t.hex().notNull(),
    /** UTC month, "YYYY-MM". */
    month: t.text().notNull(),
    checkIns: t.integer().notNull(),
    /** Earliest check-in of the month, used to break ties deterministically. */
    firstCheckInAt: t.bigint().notNull(),
    lastCheckInAt: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.month, table.member] }),
    // Leaderboard: one month, ordered by count.
    rankIdx: index().on(table.month, table.checkIns),
  }),
);
