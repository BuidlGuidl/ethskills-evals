import { describe, expect, it } from 'vitest';
import { DAY_MS, HOUR_MS, lateDays } from '../src/lib/time.js';

describe('lateDays', () => {
  const due = Date.UTC(2026, 0, 10, 12, 0, 0);

  it('is zero before and at the due moment', () => {
    expect(lateDays(due - HOUR_MS, due)).toBe(0);
    expect(lateDays(due, due)).toBe(0);
  });

  it('counts any part of a day as a whole late day', () => {
    expect(lateDays(due + 1, due)).toBe(1);
    expect(lateDays(due + 23 * HOUR_MS, due)).toBe(1);
    expect(lateDays(due + DAY_MS, due)).toBe(1);
    expect(lateDays(due + DAY_MS + 1, due)).toBe(2);
    expect(lateDays(due + 9 * DAY_MS, due)).toBe(9);
  });

  it('applies the grace period before the first day counts', () => {
    expect(lateDays(due + 5 * HOUR_MS, due, 6)).toBe(0);
    expect(lateDays(due + 7 * HOUR_MS, due, 6)).toBe(1);
    expect(lateDays(due + 6 * HOUR_MS + DAY_MS, due, 6)).toBe(1);
  });
});
