import { index, onchainTable } from "ponder";

/**
 * Read model for the three screens. Every row here is derived from `CheckedIn`
 * events replayed in order from the contract's first block, so the tables always
 * describe the complete history — not a window that starts when the app booted.
 *
 * Shape follows the queries:
 *   feed        -> `checkIn`, ordered by `sortKey` desc
 *   profile     -> `member` (one row read), plus `checkIn` filtered by member
 *   leaderboard -> `memberMonth`, ordered by `checkIns` desc within one month
 */

/** One row per check-in transaction, ever. Backs the global feed. */
export const checkIn = onchainTable(
  "check_in",
  (t) => ({
    /** `${blockNumber}-${logIndex}`, zero padded so it sorts chronologically. */
    id: t.text().primaryKey(),
    member: t.hex().notNull(),
    /** UTC day index (unix seconds / 86400), as emitted by the contract. */
    day: t.integer().notNull(),
    /** Block timestamp, unix seconds. */
    timestamp: t.integer().notNull(),
    /** "YYYY-MM" in UTC, denormalised so month filters need no date math. */
    month: t.text().notNull(),
    note: t.text().notNull(),
    /** The member's streak and all-time total as of this check-in. */
    streak: t.integer().notNull(),
    memberTotal: t.integer().notNull(),
    blockNumber: t.bigint().notNull(),
    logIndex: t.integer().notNull(),
    transactionHash: t.hex().notNull(),
  }),
  (t) => ({
    // Feed: `order by id desc limit n` walks this index backwards.
    byMember: index().on(t.member, t.id),
    byDay: index().on(t.day),
  }),
);

/** One row per address that has ever checked in. Backs the profile screen. */
export const member = onchainTable("member", (t) => ({
  address: t.hex().primaryKey(),
  /** All-time check-ins. */
  totalCheckIns: t.integer().notNull(),
  /**
   * Streak as of `lastDay`. This is *not* the streak to display: a streak decays
   * once a day is missed, and nothing onchain fires on a missed day. The API
   * derives the live value from `lastDay` (see `currentStreak` in src/api).
   */
  streakAsOfLastDay: t.integer().notNull(),
  /** Longest streak the member has ever reached. */
  longestStreak: t.integer().notNull(),
  /** UTC day index of the most recent check-in. */
  lastDay: t.integer().notNull(),
  firstCheckInAt: t.integer().notNull(),
  lastCheckInAt: t.integer().notNull(),
  /** Most recent note, so the profile header needs no second query. */
  lastNote: t.text().notNull(),
}));

/**
 * One row per (member, month). Backs the leaderboard: "top members this month"
 * is a single indexed scan instead of counting rows in `checkIn` every request.
 */
export const memberMonth = onchainTable(
  "member_month",
  (t) => ({
    /** `${month}:${address}` */
    id: t.text().primaryKey(),
    month: t.text().notNull(),
    member: t.hex().notNull(),
    checkIns: t.integer().notNull(),
    firstCheckInAt: t.integer().notNull(),
    lastCheckInAt: t.integer().notNull(),
  }),
  (t) => ({
    // Leaderboard: `where month = $1 order by check_ins desc limit n`.
    byMonthRank: index().on(t.month, t.checkIns),
  }),
);
