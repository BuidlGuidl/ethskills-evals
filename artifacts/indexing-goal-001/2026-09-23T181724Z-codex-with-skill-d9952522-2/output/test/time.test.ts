import { describe, expect, it } from "vitest";
import { activeCurrentStreak, monthKeyFromUnixSeconds, utcDayFromUnixSeconds } from "../src/time.js";

describe("time helpers", () => {
  it("derives UTC days from unix seconds", () => {
    expect(utcDayFromUnixSeconds(0)).toBe(0);
    expect(utcDayFromUnixSeconds(86_399)).toBe(0);
    expect(utcDayFromUnixSeconds(86_400)).toBe(1);
  });

  it("builds month keys in UTC", () => {
    expect(monthKeyFromUnixSeconds(Date.UTC(2026, 0, 31, 23, 59, 59) / 1000)).toBe("2026-01");
    expect(monthKeyFromUnixSeconds(Date.UTC(2026, 1, 1, 0, 0, 0) / 1000)).toBe("2026-02");
  });

  it("expires stale current streaks after a missed day", () => {
    expect(activeCurrentStreak(7, 99, 100)).toBe(7);
    expect(activeCurrentStreak(7, 100, 100)).toBe(7);
    expect(activeCurrentStreak(7, 98, 100)).toBe(0);
    expect(activeCurrentStreak(7, null, 100)).toBe(0);
  });
});

