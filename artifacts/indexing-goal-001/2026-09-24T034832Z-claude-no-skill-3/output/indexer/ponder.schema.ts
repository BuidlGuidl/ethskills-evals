import { index, onchainTable, primaryKey, relations } from "ponder";

/**
 * One row per check-in transaction, i.e. the full append-only history of the
 * contract. Backs the global feed and the "recent notes" list on a profile.
 */
export const checkIn = onchainTable(
  "check_in",
  (t) => ({
    // `${blockNumber}-${logIndex}`, unique and stable across reorgs.
    id: t.text().primaryKey(),
    member: t.hex().notNull(),
    /** UTC day index (unix seconds / 86400) the check-in counted for. */
    day: t.integer().notNull(),
    /** "YYYY-MM" (UTC) the check-in counted for. Leaderboard bucket. */
    month: t.text().notNull(),
    /** Block timestamp, unix seconds. */
    timestamp: t.bigint().notNull(),
    /** Member's consecutive-day streak including this check-in. */
    streak: t.integer().notNull(),
    /** Member's all-time check-in count including this one. */
    total: t.integer().notNull(),
    note: t.text().notNull(),
    blockNumber: t.bigint().notNull(),
    transactionHash: t.hex().notNull(),
    /**
     * Monotonic sort key: blockNumber * 10^6 + logIndex. Gives the feed a total
     * order that is stable and cursor-pageable (timestamps can tie or, on some
     * chains, repeat).
     */
    seq: t.bigint().notNull(),
  }),
  (table) => ({
    // Feed: newest first, cursor on `seq`.
    seqIdx: index().on(table.seq),
    // Profile: this member's check-ins, newest first.
    memberSeqIdx: index().on(table.member, table.seq),
  }),
);

/** One row per address that has ever checked in. Backs the profile screen. */
export const member = onchainTable(
  "member",
  (t) => ({
    address: t.hex().primaryKey(),
    /** All-time check-ins. */
    total: t.integer().notNull(),
    /**
     * Streak as of `lastDay`. This is *not* the live streak: a streak dies when
     * a day is missed, and no event fires when that happens. Read it through
     * `liveStreak()` in src/lib/streak.ts, which compares `lastDay` to today.
     */
    streakAtLastCheckIn: t.integer().notNull(),
    /** Longest streak the member has ever reached. */
    longestStreak: t.integer().notNull(),
    firstDay: t.integer().notNull(),
    lastDay: t.integer().notNull(),
    firstCheckInAt: t.bigint().notNull(),
    lastCheckInAt: t.bigint().notNull(),
    /** Most recent note, for showing next to a name without a join. */
    lastNote: t.text().notNull(),
  }),
  (table) => ({
    totalIdx: index().on(table.total),
  }),
);

/** Per-member, per-month check-in counts. Backs the leaderboard. */
export const monthlyCount = onchainTable(
  "monthly_count",
  (t) => ({
    member: t.hex().notNull(),
    /** "YYYY-MM", UTC. */
    month: t.text().notNull(),
    count: t.integer().notNull(),
    /** Sort key of this member's first check-in that month: ties break in favour of whoever got there first. */
    firstSeq: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.month, table.member] }),
    // Leaderboard: one month, ordered by count desc.
    monthCountIdx: index().on(table.month, table.count),
  }),
);

/** Per-day totals across everyone. Cheap "activity" reads without scanning the feed. */
export const dailyTotal = onchainTable("daily_total", (t) => ({
  day: t.integer().primaryKey(),
  month: t.text().notNull(),
  checkIns: t.integer().notNull(),
}));

// Relations, exposed through the GraphQL API so a client can fetch a check-in
// with its member (and vice versa) in one query.
export const checkInRelations = relations(checkIn, ({ one }) => ({
  memberRecord: one(member, { fields: [checkIn.member], references: [member.address] }),
}));

export const memberRelations = relations(member, ({ many }) => ({
  checkIns: many(checkIn),
  months: many(monthlyCount),
}));

export const monthlyCountRelations = relations(monthlyCount, ({ one }) => ({
  memberRecord: one(member, { fields: [monthlyCount.member], references: [member.address] }),
}));
