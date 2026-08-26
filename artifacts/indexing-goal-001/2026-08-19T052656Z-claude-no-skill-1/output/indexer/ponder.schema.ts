import { index, onchainTable, primaryKey, relations } from "ponder";

/**
 * One row per CheckedIn event — the immutable log of everything that ever happened.
 * This table backs the global feed and a member's own history.
 */
export const checkIn = onchainTable(
  "check_in",
  (t) => ({
    // `${blockNumber}-${logIndex}`, which is also the feed's sort key.
    id: t.text().primaryKey(),
    member: t.hex().notNull(),
    note: t.text().notNull(),
    // Unix seconds of the containing block.
    timestamp: t.integer().notNull(),
    // UTC day index (timestamp / 86400), straight from the contract.
    day: t.integer().notNull(),
    // "YYYY-MM" in UTC, denormalised so the leaderboard never has to compute it.
    month: t.text().notNull(),
    // The member's streak length including this check-in.
    streak: t.integer().notNull(),
    blockNumber: t.bigint().notNull(),
    logIndex: t.integer().notNull(),
    transactionHash: t.hex().notNull(),
  }),
  (t) => ({
    // Global feed: ORDER BY block_number DESC, log_index DESC.
    feedIdx: index().on(t.blockNumber, t.logIndex),
    // A single member's feed, same ordering.
    memberFeedIdx: index().on(t.member, t.blockNumber, t.logIndex),
    monthIdx: index().on(t.month),
  }),
);

/**
 * One row per address that has ever checked in. Every counter here is written from
 * the values the contract itself emitted, so the indexer never re-derives (and never
 * disagrees with) onchain state.
 */
export const member = onchainTable(
  "member",
  (t) => ({
    address: t.hex().primaryKey(),
    firstCheckInAt: t.integer().notNull(),
    firstDay: t.integer().notNull(),
    lastCheckInAt: t.integer().notNull(),
    lastDay: t.integer().notNull(),
    // Streak as of `lastDay`. It is NOT the live streak: a member who last checked
    // in a week ago still has a value here. The API decays it against the current
    // UTC day — see currentStreak() in src/lib/streak.ts.
    streakAsOfLastCheckIn: t.integer().notNull(),
    longestStreak: t.integer().notNull(),
    totalCheckIns: t.integer().notNull(),
  }),
  (t) => ({
    totalIdx: index().on(t.totalCheckIns),
  }),
);

/**
 * Per-member, per-month check-in counts, maintained incrementally as events arrive.
 * The monthly leaderboard is a single indexed range scan over this table instead of
 * an aggregate over the whole check_in log.
 */
export const memberMonth = onchainTable(
  "member_month",
  (t) => ({
    member: t.hex().notNull(),
    // "YYYY-MM" in UTC.
    month: t.text().notNull(),
    checkIns: t.integer().notNull(),
    firstCheckInAt: t.integer().notNull(),
    lastCheckInAt: t.integer().notNull(),
  }),
  (t) => ({
    pk: primaryKey({ columns: [t.member, t.month] }),
    leaderboardIdx: index().on(t.month, t.checkIns),
  }),
);

// Relations power the `member { checkIns { ... } }` shape in the GraphQL API.
export const memberRelations = relations(member, ({ many }) => ({
  checkIns: many(checkIn),
  months: many(memberMonth),
}));

export const checkInRelations = relations(checkIn, ({ one }) => ({
  memberRecord: one(member, {
    fields: [checkIn.member],
    references: [member.address],
  }),
}));

export const memberMonthRelations = relations(memberMonth, ({ one }) => ({
  memberRecord: one(member, {
    fields: [memberMonth.member],
    references: [member.address],
  }),
}));
