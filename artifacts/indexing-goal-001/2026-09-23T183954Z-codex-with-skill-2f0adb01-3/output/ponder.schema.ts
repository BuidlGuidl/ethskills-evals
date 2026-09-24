import { index, onchainTable, primaryKey } from "ponder";

export const checkIns = onchainTable(
  "check_ins",
  (t) => ({
    id: t.text().primaryKey(),
    checkInId: t.bigint().notNull(),
    member: t.hex().notNull(),
    day: t.integer().notNull(),
    note: t.text().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    transactionHash: t.hex().notNull(),
    logIndex: t.integer().notNull(),
  }),
  (table) => ({
    feedIdx: index().on(table.blockNumber, table.logIndex),
    memberIdx: index().on(table.member),
    memberDayIdx: index().on(table.member, table.day),
  }),
);

export const members = onchainTable("members", (t) => ({
  address: t.hex().primaryKey(),
  totalCheckIns: t.integer().notNull(),
  streakAtLastCheckIn: t.integer().notNull(),
  lastCheckInDay: t.integer().notNull(),
  lastCheckInAt: t.bigint().notNull(),
  updatedAt: t.bigint().notNull(),
}));

export const memberMonths = onchainTable(
  "member_months",
  (t) => ({
    member: t.hex().notNull(),
    month: t.text().notNull(),
    checkIns: t.integer().notNull(),
    lastCheckInAt: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.member, table.month] }),
    monthRankIdx: index().on(table.month, table.checkIns, table.lastCheckInAt),
  }),
);
