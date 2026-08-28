/** UTC day index used by the contract: `block.timestamp / 1 days`. */
export const dayFromTimestamp = (timestamp: number | bigint): number =>
  Math.floor(Number(timestamp) / 86_400);

/** "YYYY-MM" (UTC) for a contract day index. */
export const monthFromDay = (day: number): string =>
  new Date(day * 86_400_000).toISOString().slice(0, 7);

/** The current UTC day index. */
export const currentDay = (now: Date = new Date()): number =>
  Math.floor(now.getTime() / 86_400_000);

/** The current "YYYY-MM" (UTC). */
export const currentMonth = (now: Date = new Date()): string =>
  now.toISOString().slice(0, 7);

/**
 * A stored streak is only alive if the member checked in today or yesterday --
 * the same rule as `Streak.currentStreak`. Applied at read time so a profile does
 * not show a stale streak for someone who stopped checking in.
 */
export const liveStreak = (
  lastDay: number,
  streakAtLastDay: number,
  today: number = currentDay(),
): number => (lastDay === today || lastDay + 1 === today ? streakAtLastDay : 0);
