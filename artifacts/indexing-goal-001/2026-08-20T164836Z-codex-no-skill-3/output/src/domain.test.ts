import assert from "node:assert/strict";
import test from "node:test";
import { currentStreak, SECONDS_PER_DAY, utcMonthBounds } from "./domain.js";

test("streak accepts today and walks backward across consecutive UTC days", () => {
  assert.equal(currentStreak([10, 9, 8, 6], 10 * SECONDS_PER_DAY + 3), 3);
});

test("streak can begin yesterday but not earlier", () => {
  assert.equal(currentStreak([9, 8], 10 * SECONDS_PER_DAY), 2);
  assert.equal(currentStreak([8, 7], 10 * SECONDS_PER_DAY), 0);
});

test("month bounds use UTC rather than server local time", () => {
  const { startDay, endDay } = utcMonthBounds(Date.UTC(2026, 7, 20) / 1_000);
  assert.equal(startDay, Date.UTC(2026, 7, 1) / 1_000 / SECONDS_PER_DAY);
  assert.equal(endDay, Date.UTC(2026, 8, 1) / 1_000 / SECONDS_PER_DAY);
});
