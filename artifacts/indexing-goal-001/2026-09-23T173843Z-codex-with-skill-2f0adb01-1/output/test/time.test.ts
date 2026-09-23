import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveCurrentStreak,
  monthKeyFromTimestamp,
  utcDayFromTimestamp,
} from "../src/time.js";

describe("time helpers", () => {
  it("turns timestamps into UTC day numbers and month keys", () => {
    assert.equal(utcDayFromTimestamp(0), 0);
    assert.equal(utcDayFromTimestamp(86_399), 0);
    assert.equal(utcDayFromTimestamp(86_400), 1);
    assert.equal(monthKeyFromTimestamp(Date.UTC(2026, 8, 23) / 1000), "2026-09");
  });

  it("keeps a streak current through today or yesterday only", () => {
    const day10Noon = 10 * 86_400 + 43_200;

    assert.equal(deriveCurrentStreak(4, 10, day10Noon), 4);
    assert.equal(deriveCurrentStreak(4, 9, day10Noon), 4);
    assert.equal(deriveCurrentStreak(4, 8, day10Noon), 0);
    assert.equal(deriveCurrentStreak(4, null, day10Noon), 0);
  });
});
