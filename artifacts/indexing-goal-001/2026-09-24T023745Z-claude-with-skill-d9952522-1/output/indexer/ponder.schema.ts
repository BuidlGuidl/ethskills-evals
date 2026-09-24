import { index, onchainTable, primaryKey } from "ponder";

/**
 * One row per check-in, for the global feed.
 *
 * This is the append-only record of the contract's entire history: the backfill
 * writes every past check-in here, and the realtime tail appends new ones. The
 * feed reads it newest-first, so it is ordered by `ordinal` rather than by
 * `timestamp` — several check-ins can share a block, and a Base block timestamp
 * is only second-resolution, so timestamps tie and would paginate unstably.
 */
export const checkIn = onchainTable(
  "check_in",
  (t) => ({
    /** `${blockNumber}-${logIndex}`, unique and human-readable. */
    id: t.text().primaryKey(),
    /** Total order over all check-ins: blockNumber << 16 | logIndex. */
    ordinal: t.bigint().notNull(),
    member: t.hex().notNull(),
    /** Contract day index this check-in counted for. */
    day: t.integer().notNull(),
    /** `YYYY-MM`, denormalized so the leaderboard never computes it at read time. */
    month: t.text().notNull(),
    timestamp: t.integer().notNull(),
    note: t.text().notNull(),
    /** The member's streak and total *after* this check-in, straight from the event. */
    streakAfter: t.integer().notNull(),
    totalAfter: t.integer().notNull(),
    blockNumber: t.bigint().notNull(),
    transactionHash: t.hex().notNull(),
  }),
  (t) => ({
    // Global feed, newest first.
    feedIdx: index().on(t.ordinal),
    // A single member's history, newest first (profile page).
    memberIdx: index().on(t.member, t.ordinal),
  }),
);

/**
 * One row per member: the aggregate a profile page needs in a single lookup.
 *
 * `currentStreak` is the value as of `lastDay` and must be decayed at read time
 * (see `liveStreak` in src/days.ts) — a broken streak emits no event.
 */
export const member = onchainTable(
  "member",
  (t) => ({
    address: t.hex().primaryKey(),
    firstDay: t.integer().notNull(),
    firstCheckInAt: t.integer().notNull(),
    lastDay: t.integer().notNull(),
    lastCheckInAt: t.integer().notNull(),
    /** Most recent note, for a profile header. */
    lastNote: t.text().notNull(),
    /** Streak as of `lastDay`; decay before displaying. */
    currentStreak: t.integer().notNull(),
    longestStreak: t.integer().notNull(),
    totalCheckIns: t.integer().notNull(),
  }),
  (t) => ({
    // "Most check-ins all time" and "longest streak" boards.
    totalIdx: index().on(t.totalCheckIns),
    longestIdx: index().on(t.longestStreak),
  }),
);

/**
 * Per-member, per-month check-in counts: the leaderboard, pre-aggregated.
 *
 * Counting a month's check-ins by scanning `check_in` would work today and get
 * slower every month. Incrementing a counter as events arrive keeps the
 * leaderboard a single indexed range scan no matter how long the history gets,
 * and keeps every past month queryable, not just the current one.
 */
export const memberMonth = onchainTable(
  "member_month",
  (t) => ({
    member: t.hex().notNull(),
    /** `YYYY-MM`. */
    month: t.text().notNull(),
    checkIns: t.integer().notNull(),
    /** Best streak reached during this month, as a tiebreaker. */
    bestStreak: t.integer().notNull(),
    lastCheckInAt: t.integer().notNull(),
  }),
  (t) => ({
    pk: primaryKey({ columns: [t.member, t.month] }),
    // Leaderboard: one month, ordered by count.
    boardIdx: index().on(t.month, t.checkIns),
  }),
);

/**
 * Community-wide daily totals — cheap to maintain, and what an activity chart
 * or "how many of us showed up today" banner reads.
 */
export const dayStat = onchainTable(
  "day_stat",
  (t) => ({
    /** Contract day index. */
    day: t.integer().primaryKey(),
    month: t.text().notNull(),
    checkIns: t.integer().notNull(),
    /** New members who joined on this day. */
    newMembers: t.integer().notNull(),
  }),
  (t) => ({
    monthIdx: index().on(t.month),
  }),
);

/** Single-row global counters, so /stats is one lookup. */
export const globalStat = onchainTable("global_stat", (t) => ({
  id: t.text().primaryKey(),
  totalCheckIns: t.integer().notNull(),
  totalMembers: t.integer().notNull(),
  firstDay: t.integer().notNull(),
  lastDay: t.integer().notNull(),
}));
