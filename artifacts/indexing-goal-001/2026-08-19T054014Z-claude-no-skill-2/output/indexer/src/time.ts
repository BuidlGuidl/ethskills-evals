/** UTC time helpers. Days and months are UTC everywhere, matching the contract. */

export const SECONDS_PER_DAY = 86_400;

/** UTC day index for a unix timestamp in seconds — the contract's `day`. */
export function dayIndex(timestampSeconds: number | bigint): number {
  return Math.floor(Number(timestampSeconds) / SECONDS_PER_DAY);
}

/** "YYYY-MM" (UTC) for a unix timestamp in seconds. */
export function monthKey(timestampSeconds: number | bigint): string {
  return new Date(Number(timestampSeconds) * 1000).toISOString().slice(0, 7);
}

/** Today's UTC day index, from wall-clock time. */
export function currentDayIndex(now: Date = new Date()): number {
  return Math.floor(now.getTime() / 1000 / SECONDS_PER_DAY);
}

/** The current UTC month, "YYYY-MM". */
export function currentMonthKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/**
 * A stored streak is only still alive if the last check-in was today or
 * yesterday; miss a whole day and it has lapsed. Mirrors
 * `Streak.currentStreakOf` so the API and the contract never disagree.
 */
export function liveStreak(
  storedStreak: number,
  lastDay: number,
  today: number = currentDayIndex(),
): number {
  return lastDay === today || lastDay === today - 1 ? storedStreak : 0;
}
