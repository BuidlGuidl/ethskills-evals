import { onchainTable } from "ponder";

export const checkIn = onchainTable("check_in", (t) => ({
  id: t.text().primaryKey(),
  member: t.hex().notNull(),
  note: t.text().notNull(),
  timestamp: t.bigint().notNull(),
  day: t.integer().notNull(),
  blockNumber: t.bigint().notNull(),
  transactionHash: t.hex().notNull(),
  logIndex: t.integer().notNull(),
}));

export const member = onchainTable("member", (t) => ({
  address: t.hex().primaryKey(),
  currentStreak: t.integer().notNull(),
  totalCheckIns: t.integer().notNull(),
  latestDay: t.integer().notNull(),
  latestCheckInAt: t.bigint().notNull(),
}));

export const monthlyMember = onchainTable("monthly_member", (t) => ({
  id: t.text().primaryKey(),
  month: t.text().notNull(),
  member: t.hex().notNull(),
  checkIns: t.integer().notNull(),
}));
