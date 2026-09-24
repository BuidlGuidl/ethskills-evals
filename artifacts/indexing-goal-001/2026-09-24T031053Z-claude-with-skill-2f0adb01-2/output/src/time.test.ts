import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  canCheckInToday,
  currentMonthKey,
  dateKey,
  dayIndex,
  liveStreak,
  monthDayRange,
  monthKey,
  relativeTime,
} from "./time.js";

const DAY = 86_400;
const day = (d: string) => dayIndex(Date.parse(`${d}T00:00:00Z`) / 1000);

test("dayIndex matches the contract's timestamp / 86400", () => {
  assert.equal(dayIndex(0), 0);
  assert.equal(dayIndex(DAY - 1), 0);
  assert.equal(dayIndex(DAY), 1);
  assert.equal(dayIndex(1_750_000_000), 20254);
});

test("dateKey and monthKey round-trip UTC days", () => {
  assert.equal(dateKey(0), "1970-01-01");
  assert.equal(dateKey(day("2024-02-29")), "2024-02-29");
  assert.equal(dateKey(day("2026-01-01")), "2026-01-01");
  assert.equal(monthKey(day("2026-09-30")), "2026-09");
  assert.equal(monthKey(day("2025-12-31")), "2025-12");
});

test("monthDayRange covers the whole month, leap years included", () => {
  const feb24 = monthDayRange("2024-02");
  assert.equal(dateKey(feb24.firstDay), "2024-02-01");
  assert.equal(dateKey(feb24.lastDay), "2024-02-29");

  const dec = monthDayRange("2025-12");
  assert.equal(dateKey(dec.firstDay), "2025-12-01");
  assert.equal(dateKey(dec.lastDay), "2025-12-31");
  assert.equal(dec.lastDay - dec.firstDay + 1, 31);
});

test("currentMonthKey reads the month of `now`", () => {
  assert.equal(currentMonthKey(Date.parse("2026-09-24T18:00:00Z") / 1000), "2026-09");
  assert.equal(currentMonthKey(Date.parse("2026-09-30T23:59:59Z") / 1000), "2026-09");
  assert.equal(currentMonthKey(Date.parse("2026-10-01T00:00:00Z") / 1000), "2026-10");
});

test("liveStreak keeps a streak alive today and yesterday", () => {
  const now = Date.parse("2026-09-24T09:00:00Z") / 1000;
  assert.equal(liveStreak(7, day("2026-09-24"), now), 7, "checked in today");
  assert.equal(liveStreak(7, day("2026-09-23"), now), 7, "yesterday — still saveable");
});

test("liveStreak tolerates a client clock running behind the chain", () => {
  // The chain is into 2026-09-25 while this client still thinks it is the 24th.
  const clientNow = Date.parse("2026-09-24T23:59:50Z") / 1000;
  assert.equal(liveStreak(9, day("2026-09-25"), clientNow), 9);
});

test("liveStreak zeroes a lapsed streak", () => {
  const now = Date.parse("2026-09-24T09:00:00Z") / 1000;
  assert.equal(liveStreak(7, day("2026-09-22"), now), 0, "one whole day missed");
  assert.equal(liveStreak(60, day("2026-06-01"), now), 0, "long gone");
  assert.equal(liveStreak(0, day("2026-09-24"), now), 0, "no streak to keep");
});

test("liveStreak survives the UTC midnight boundary exactly", () => {
  const lastDay = day("2026-09-23");
  const justBefore = Date.parse("2026-09-24T23:59:59Z") / 1000;
  const justAfter = Date.parse("2026-09-25T00:00:00Z") / 1000;
  assert.equal(liveStreak(5, lastDay, justBefore), 5, "last second to save it");
  assert.equal(liveStreak(5, lastDay, justAfter), 0, "midnight passed, streak dead");
});

test("canCheckInToday is false only once today's check-in landed", () => {
  const now = Date.parse("2026-09-24T09:00:00Z") / 1000;
  assert.equal(canCheckInToday(day("2026-09-24"), now), false);
  assert.equal(canCheckInToday(day("2026-09-23"), now), true);
  assert.equal(canCheckInToday(0, now), true, "never checked in");
});

test("relativeTime formats feed ages", () => {
  const now = 1_000_000;
  assert.equal(relativeTime(now, now), "0s ago");
  assert.equal(relativeTime(now - 90, now), "1m ago");
  assert.equal(relativeTime(now - 7200, now), "2h ago");
  assert.equal(relativeTime(now - 3 * DAY, now), "3d ago");
  assert.equal(relativeTime(now + 5, now), "0s ago", "clock skew must not go negative");
});
