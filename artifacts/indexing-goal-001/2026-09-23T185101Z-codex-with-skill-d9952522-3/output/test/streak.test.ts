import assert from "node:assert/strict";
import test from "node:test";
import { decodeFeedCursor, encodeFeedCursor } from "../src/shared/cursor.js";
import { activeCurrentStreak, dayNumberFromDate, monthStartFromDate, parseMonthStart } from "../src/shared/streak.js";

test("activeCurrentStreak stays active through today and yesterday", () => {
  const now = new Date("2026-09-23T12:00:00.000Z");
  const today = dayNumberFromDate(now);

  assert.equal(activeCurrentStreak({ storedCurrentStreak: 7, lastCheckInDay: today, now }), 7);
  assert.equal(activeCurrentStreak({ storedCurrentStreak: 7, lastCheckInDay: today - 1, now }), 7);
  assert.equal(activeCurrentStreak({ storedCurrentStreak: 7, lastCheckInDay: today - 2, now }), 0);
  assert.equal(activeCurrentStreak({ storedCurrentStreak: 7, lastCheckInDay: null, now }), 0);
});

test("month helpers use UTC calendar months", () => {
  assert.equal(monthStartFromDate(new Date("2026-09-30T23:59:59.000Z")), "2026-09-01");
  assert.equal(parseMonthStart("2026-02"), "2026-02-01");
  assert.throws(() => parseMonthStart("2026-13"), /YYYY-MM/);
});

test("feed cursors round trip", () => {
  const cursor = {
    checkedAt: "2026-09-23T12:00:00.000Z",
    blockNumber: "123",
    logIndex: 4,
  };

  assert.deepEqual(decodeFeedCursor(encodeFeedCursor(cursor)), cursor);
});
