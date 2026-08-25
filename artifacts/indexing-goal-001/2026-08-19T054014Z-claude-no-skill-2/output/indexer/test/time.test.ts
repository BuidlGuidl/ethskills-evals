import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  currentDayIndex,
  currentMonthKey,
  dayIndex,
  liveStreak,
  monthKey,
  SECONDS_PER_DAY,
} from "../src/time.ts";

describe("dayIndex", () => {
  it("matches the contract's timestamp / 86400", () => {
    assert.equal(dayIndex(0), 0);
    assert.equal(dayIndex(SECONDS_PER_DAY - 1), 0);
    assert.equal(dayIndex(SECONDS_PER_DAY), 1);
    assert.equal(dayIndex(1_700_000_000), Math.floor(1_700_000_000 / 86_400));
  });

  it("accepts bigint timestamps, which is what the event gives us", () => {
    assert.equal(dayIndex(1_700_000_000n), dayIndex(1_700_000_000));
  });
});

describe("monthKey", () => {
  it("buckets by UTC month", () => {
    assert.equal(monthKey(Date.UTC(2026, 7, 19, 12) / 1000), "2026-08");
  });

  it("puts the last second of a month in that month", () => {
    assert.equal(monthKey(Date.UTC(2026, 7, 31, 23, 59, 59) / 1000), "2026-08");
    assert.equal(monthKey(Date.UTC(2026, 8, 1, 0, 0, 0) / 1000), "2026-09");
  });

  it("uses UTC, not the machine's timezone", () => {
    // 23:30 UTC on the 31st is already the 1st in, say, Europe/Berlin. The
    // leaderboard has to agree with the chain, so it must stay UTC.
    assert.equal(monthKey(Date.UTC(2026, 7, 31, 23, 30) / 1000), "2026-08");
  });
});

describe("liveStreak", () => {
  const today = 20_000;

  it("keeps the streak when the member checked in today", () => {
    assert.equal(liveStreak(7, today, today), 7);
  });

  it("keeps the streak when the member checked in yesterday", () => {
    // Today isn't over — the streak is still theirs to continue.
    assert.equal(liveStreak(7, today - 1, today), 7);
  });

  it("drops the streak once a whole day has been missed", () => {
    assert.equal(liveStreak(7, today - 2, today), 0);
    assert.equal(liveStreak(365, today - 30, today), 0);
  });

  it("is zero for a member with no history", () => {
    assert.equal(liveStreak(0, 0, today), 0);
  });
});

describe("current* helpers", () => {
  it("derives today's day index from wall-clock time", () => {
    const now = new Date("2026-08-19T05:00:00Z");
    assert.equal(currentDayIndex(now), Math.floor(Date.UTC(2026, 7, 19) / 1000 / 86_400));
  });

  it("derives the current month key from wall-clock time", () => {
    assert.equal(currentMonthKey(new Date("2026-08-19T05:00:00Z")), "2026-08");
  });
});
