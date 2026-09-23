import { index, onchainTable } from "ponder";

export const checkIns = onchainTable(
  "check_ins",
  (t) => ({
    id: t.text().primaryKey(),
    member: t.hex().notNull(),
    day: t.integer().notNull(),
    timestamp: t.integer().notNull(),
    month: t.text().notNull(),
    note: t.text().notNull(),
    transactionHash: t.hex().notNull(),
    blockNumber: t.bigint().notNull(),
    logIndex: t.integer().notNull(),
  }),
  (table) => ({
    feedIdx: index().on(table.timestamp),
    memberIdx: index().on(table.member),
    memberDayIdx: index().on(table.member, table.day),
    monthIdx: index().on(table.month),
  }),
);

export const members = onchainTable(
  "members",
  (t) => ({
    address: t.hex().primaryKey(),
    totalCheckIns: t.integer().notNull(),
    currentStreak: t.integer().notNull(),
    lastCheckInDay: t.integer().notNull(),
    lastCheckInAt: t.integer().notNull(),
  }),
  (table) => ({
    currentStreakIdx: index().on(table.currentStreak),
    totalCheckInsIdx: index().on(table.totalCheckIns),
  }),
);

export const monthlyMemberCheckIns = onchainTable(
  "monthly_member_check_ins",
  (t) => ({
    id: t.text().primaryKey(),
    member: t.hex().notNull(),
    month: t.text().notNull(),
    checkIns: t.integer().notNull(),
    lastCheckInAt: t.integer().notNull(),
  }),
  (table) => ({
    monthIdx: index().on(table.month),
    leaderboardIdx: index().on(table.month, table.checkIns),
    memberIdx: index().on(table.member),
  }),
);
