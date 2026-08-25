import { index, onchainTable } from "ponder";

/**
 * One row per `CheckedIn` event — the raw, append-only record that backs the
 * global feed and every derived table below.
 *
 * `id` is `<blockNumber padded>-<logIndex padded>`, which sorts
 * lexicographically in chain order. That lets the feed page with a plain
 * `id < cursor` comparison instead of an offset, so page N costs the same as
 * page 1 no matter how many months of history sit behind it.
 */
export const checkIn = onchainTable(
  "check_in",
  (t) => ({
    id: t.text().primaryKey(),
    member: t.hex().notNull(),
    day: t.integer().notNull(),
    timestamp: t.integer().notNull(),
    note: t.text().notNull(),
    month: t.integer().notNull(),
    blockNumber: t.bigint().notNull(),
    transactionHash: t.hex().notNull(),
  }),
  (table) => ({
    // Profile screen: this member's check-ins, newest first.
    memberIdx: index().on(table.member, table.id),
  }),
);

/**
 * One row per member, maintained incrementally as events are indexed.
 *
 * `currentStreak` is the streak as of `lastDay`. It is *not* decayed here — a
 * member who stops checking in emits no event, so nothing would trigger the
 * write. The API applies the decay at read time (see `resolveCurrentStreak`).
 */
export const member = onchainTable("member", (t) => ({
  address: t.hex().primaryKey(),
  totalCheckIns: t.integer().notNull(),
  currentStreak: t.integer().notNull(),
  longestStreak: t.integer().notNull(),
  firstDay: t.integer().notNull(),
  lastDay: t.integer().notNull(),
  firstCheckInAt: t.integer().notNull(),
  lastCheckInAt: t.integer().notNull(),
  lastNote: t.text().notNull(),
}));

/**
 * Per-member, per-calendar-month check-in counts. `month` is a UTC `YYYYMM`
 * integer (e.g. 202608), which keeps the leaderboard a single indexed range
 * scan instead of an aggregate over the whole history.
 */
export const memberMonth = onchainTable(
  "member_month",
  (t) => ({
    id: t.text().primaryKey(), // `${address}-${month}`
    member: t.hex().notNull(),
    month: t.integer().notNull(),
    checkIns: t.integer().notNull(),
    lastCheckInAt: t.integer().notNull(),
  }),
  (table) => ({
    leaderboardIdx: index().on(table.month, table.checkIns),
  }),
);
