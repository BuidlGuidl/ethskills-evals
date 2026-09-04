import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/database.js";
import { applyCheckIn } from "../src/processor.js";

describe("check-in projections", () => {
  it("computes totals, consecutive streaks, months, and ignores duplicate logs", () => {
    const db = openDatabase(":memory:");
    const add = (id: string, day: number, timestamp: number) => applyCheckIn(db, {
      id, member: "0xabc", day, note: "gm", timestamp, blockNumber: day, transactionHash: id, logIndex: 0
    });
    add("a", 10, Date.UTC(2026, 0, 31) / 1000);
    add("b", 11, Date.UTC(2026, 1, 1) / 1000);
    add("b", 11, Date.UTC(2026, 1, 1) / 1000);
    add("c", 13, Date.UTC(2026, 1, 3) / 1000);
    expect(db.prepare("SELECT total, current_streak FROM members").get()).toEqual({ total: 3, current_streak: 1 });
    expect(db.prepare("SELECT month, count FROM monthly_counts ORDER BY month").all()).toEqual([
      { month: "2026-01", count: 1 }, { month: "2026-02", count: 2 }
    ]);
  });
});
