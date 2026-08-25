import test from "node:test";
import assert from "node:assert/strict";
import { openDb, insertBatch } from "../src/db.js";
import { memberProfile, monthlyLeaderboard } from "../src/queries.js";

const row = (member: string, day: number, i: number) => ({ txHash: `0x${i.toString(16).padStart(64, "0")}`, logIndex: 0, member, day, note: "gm", blockNumber: i, timestamp: day * 86400 });

test("profile counts history and only consecutive current days", () => {
  const db = openDb(":memory:");
  insertBatch(db, [row("0xabc", 98, 1), row("0xabc", 99, 2), row("0xabc", 100, 3), row("0xabc", 90, 4)], 5n);
  assert.deepEqual(memberProfile(db, "0xAbC", 100), { member: "0xabc", currentStreak: 3, totalCheckIns: 4, lastCheckInDay: 100 });
  assert.equal(memberProfile(db, "0xabc", 102).currentStreak, 0);
});

test("leaderboard uses UTC calendar month", () => {
  const db = openDb(":memory:");
  const jan = Math.floor(Date.parse("2026-01-01T00:00:00Z") / 86400000);
  insertBatch(db, [row("a", jan, 1), row("a", jan + 1, 2), row("b", jan + 2, 3), row("b", jan + 31, 4)], 5n);
  assert.deepEqual(monthlyLeaderboard(db, "2026-01"), [{ member: "a", count: 2 }, { member: "b", count: 1 }]);
});
