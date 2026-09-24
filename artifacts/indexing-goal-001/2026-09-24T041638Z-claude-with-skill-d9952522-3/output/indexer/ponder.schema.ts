import { index, onchainTable, primaryKey, relations } from "ponder";

/// One row per CheckedIn event, for the global feed and per-member history.
export const checkIn = onchainTable(
  "check_in",
  (t) => ({
    // blockNumber * 1e6 + logIndex: a single monotonic key, so the feed can be
    // ordered and keyset-paginated with one column.
    seq: t.bigint().primaryKey(),
    member: t.hex().notNull(),
    note: t.text().notNull(),
    day: t.integer().notNull(), // UTC day index from the event
    month: t.text().notNull(), // "YYYY-MM" (UTC), the leaderboard bucket
    streak: t.integer().notNull(), // streak as of this check-in
    memberTotal: t.integer().notNull(), // member's all-time total as of this check-in
    timestamp: t.integer().notNull(), // block timestamp, seconds
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    // Global feed: newest first.
    feedIdx: index().on(table.seq),
    // Per-member history: newest first.
    memberIdx: index().on(table.member, table.seq),
  }),
);

/// One row per member: all-time aggregates that the feed and profile screens read.
export const member = onchainTable(
  "member",
  (t) => ({
    address: t.hex().primaryKey(),
    total: t.integer().notNull(),
    longestStreak: t.integer().notNull(),
    // Streak as of `lastDay`. NOT the current streak: whether it is still alive
    // depends on today's date, so the API derives that at query time (and the
    // profile screen prefers the contract's own profileOf view).
    streakAtLastDay: t.integer().notNull(),
    firstDay: t.integer().notNull(),
    lastDay: t.integer().notNull(),
    firstCheckInAt: t.integer().notNull(),
    lastCheckInAt: t.integer().notNull(),
    lastNote: t.text().notNull(),
  }),
  (table) => ({
    totalIdx: index().on(table.total),
  }),
);

/// Per-member, per-month counts. Pre-aggregated so the monthly leaderboard is a
/// single indexed ORDER BY instead of a scan over every check-in ever.
export const memberMonth = onchainTable(
  "member_month",
  (t) => ({
    member: t.hex().notNull(),
    month: t.text().notNull(), // "YYYY-MM" UTC
    checkIns: t.integer().notNull(),
    lastCheckInAt: t.integer().notNull(),
    longestStreakInMonth: t.integer().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.member, table.month] }),
    leaderboardIdx: index().on(table.month, table.checkIns),
  }),
);

/// Community-wide totals, one row (id = "global").
export const stats = onchainTable("stats", (t) => ({
  id: t.text().primaryKey(),
  totalCheckIns: t.integer().notNull(),
  totalMembers: t.integer().notNull(),
  lastCheckInAt: t.integer().notNull(),
}));

export const checkInRelations = relations(checkIn, ({ one }) => ({
  member: one(member, { fields: [checkIn.member], references: [member.address] }),
}));

export const memberRelations = relations(member, ({ many }) => ({
  checkIns: many(checkIn),
  months: many(memberMonth),
}));

export const memberMonthRelations = relations(memberMonth, ({ one }) => ({
  memberRow: one(member, { fields: [memberMonth.member], references: [member.address] }),
}));
