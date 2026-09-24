export const SECONDS_PER_DAY = 86_400;

/// UTC "YYYY-MM" bucket for a unix timestamp in seconds.
export function monthKey(timestampSeconds: number): string {
  const d = new Date(timestampSeconds * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/// The UTC day index (timestamp / 86400) the contract uses.
export function dayIndex(timestampSeconds: number): number {
  return Math.floor(timestampSeconds / SECONDS_PER_DAY);
}

export function currentMonthKey(now = Date.now()): string {
  return monthKey(Math.floor(now / 1000));
}

export function currentDayIndex(now = Date.now()): number {
  return dayIndex(Math.floor(now / 1000));
}

/// A streak is alive only if the last check-in was today or yesterday; otherwise
/// it has silently expired with no event to mark it. Mirrors Streak.profileOf.
export function liveStreak(streakAtLastDay: number, lastDay: number, today = currentDayIndex()): number {
  return lastDay === today || lastDay + 1 === today ? streakAtLastDay : 0;
}
