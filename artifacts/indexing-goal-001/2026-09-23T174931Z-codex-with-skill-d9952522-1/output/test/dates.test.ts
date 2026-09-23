import { describe, expect, it } from "vitest";
import {
  activeCurrentStreak,
  dayFromUnixTimestamp,
  monthFromUnixTimestamp,
} from "../src/dates";

describe("date helpers", () => {
  it("uses UTC unix days", () => {
    expect(dayFromUnixTimestamp(0)).toBe(0);
    expect(dayFromUnixTimestamp(86_399)).toBe(0);
    expect(dayFromUnixTimestamp(86_400)).toBe(1);
  });

  it("formats UTC months", () => {
    expect(monthFromUnixTimestamp(Date.UTC(2026, 8, 23, 12) / 1000)).toBe("2026-09");
  });

  it("expires current streaks after missing a full UTC day", () => {
    expect(activeCurrentStreak(4, 10, 10)).toBe(4);
    expect(activeCurrentStreak(4, 9, 10)).toBe(4);
    expect(activeCurrentStreak(4, 8, 10)).toBe(0);
  });
});
