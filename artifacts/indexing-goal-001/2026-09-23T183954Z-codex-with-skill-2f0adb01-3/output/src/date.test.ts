import { describe, expect, it } from "vitest";

import {
  currentMonthKey,
  currentUtcDay,
  effectiveCurrentStreak,
  isMonthKey,
  unixSecondsToMonthKey,
  unixSecondsToUtcDay,
} from "./date";

describe("date helpers", () => {
  it("converts timestamps to UTC contract days", () => {
    expect(unixSecondsToUtcDay(0)).toBe(0);
    expect(unixSecondsToUtcDay(86_399)).toBe(0);
    expect(unixSecondsToUtcDay(86_400)).toBe(1);
  });

  it("uses UTC months for monthly leaderboard buckets", () => {
    expect(unixSecondsToMonthKey(Date.UTC(2026, 8, 1, 0, 0, 0) / 1000)).toBe("2026-09");
    expect(currentMonthKey(new Date(Date.UTC(2026, 11, 31, 23, 59, 59)))).toBe("2026-12");
    expect(currentUtcDay(new Date(Date.UTC(1970, 0, 2, 0, 0, 0)))).toBe(1);
  });

  it("keeps a streak active through the day after the last check-in", () => {
    expect(effectiveCurrentStreak(7, 100, 100)).toBe(7);
    expect(effectiveCurrentStreak(7, 99, 100)).toBe(7);
    expect(effectiveCurrentStreak(7, 98, 100)).toBe(0);
  });

  it("validates month keys", () => {
    expect(isMonthKey("2026-09")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("26-09")).toBe(false);
  });
});
