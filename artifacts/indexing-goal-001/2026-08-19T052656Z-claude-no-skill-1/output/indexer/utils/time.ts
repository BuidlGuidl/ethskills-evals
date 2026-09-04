/**
 * Day/month helpers shared by the indexing functions and the API.
 *
 * Everything in Streak is UTC-based: the contract derives a day index as
 * `block.timestamp / 86400`, so day and month boundaries here must use UTC too or
 * streaks and monthly leaderboards will disagree with the chain.
 */

export const SECONDS_PER_DAY = 86_400;

/** UTC day index for a unix timestamp in seconds — the same value the contract emits. */
export function dayOf(timestampSeconds: number): number {
  return Math.floor(timestampSeconds / SECONDS_PER_DAY);
}

/** The UTC day index right now. */
export function currentDay(nowMs: number = Date.now()): number {
  return dayOf(Math.floor(nowMs / 1000));
}

/** "YYYY-MM" (UTC) for a unix timestamp in seconds. */
export function monthOf(timestampSeconds: number): string {
  return new Date(timestampSeconds * 1000).toISOString().slice(0, 7);
}

/** "YYYY-MM" (UTC) for the current month. */
export function currentMonth(nowMs: number = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 7);
}

/** True for a well-formed "YYYY-MM" month key. */
export function isMonthKey(value: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  return true;
}

/**
 * A member's streak as of *now*, given the values recorded at their last check-in.
 *
 * The stored streak is only true as of `lastDay`. Somebody who checked in for 12 days
 * and then went quiet for a week still has `streakAsOfLastCheckIn === 12`, but their
 * live streak is 0. A streak survives the whole of the day after `lastDay` — that is
 * the window in which the member can still check in and keep it alive.
 */
export function liveStreak(
  record: { lastDay: number; streakAsOfLastCheckIn: number } | undefined,
  today: number = currentDay(),
): number {
  if (record === undefined) return 0;
  return record.lastDay === today || record.lastDay === today - 1
    ? record.streakAsOfLastCheckIn
    : 0;
}
