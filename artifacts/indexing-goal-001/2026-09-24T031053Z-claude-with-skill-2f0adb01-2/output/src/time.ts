/**
 * UTC day arithmetic. The contract counts days as `timestamp / 86400`, so every
 * day boundary in this app is a UTC midnight. Everything here is pure.
 */
export const SECONDS_PER_DAY = 86_400;

/** UTC day index (Unix day number) for a unix timestamp in seconds. */
export function dayIndex(unixSeconds: number): number {
  return Math.floor(unixSeconds / SECONDS_PER_DAY);
}

/** The current UTC day index. */
export function todayIndex(now: number = Date.now() / 1000): number {
  return dayIndex(now);
}

/** UTC day index -> "YYYY-MM-DD". */
export function dateKey(day: number): string {
  return new Date(day * SECONDS_PER_DAY * 1000).toISOString().slice(0, 10);
}

/** UTC day index -> "YYYY-MM" (the leaderboard's month key). */
export function monthKey(day: number): string {
  return dateKey(day).slice(0, 7);
}

/** The current month key, e.g. "2026-09". */
export function currentMonthKey(now: number = Date.now() / 1000): string {
  return monthKey(todayIndex(now));
}

/** Inclusive [firstDay, lastDay] UTC day indices of a "YYYY-MM" month. */
export function monthDayRange(month: string): { firstDay: number; lastDay: number } {
  const [year, m] = month.split("-").map(Number);
  const firstDay = dayIndex(Date.UTC(year, m - 1, 1) / 1000);
  const lastDay = dayIndex(Date.UTC(m === 12 ? year + 1 : year, m % 12, 1) / 1000) - 1;
  return { firstDay, lastDay };
}

/**
 * The streak to actually display.
 *
 * A stored streak is only true "as of" the member's last check-in day. Streaks
 * die from *inaction*, and inaction emits no event — so no indexer can update
 * the value at the moment it lapses. The rule: the streak is still alive if the
 * member checked in today, or yesterday (they can still save it before UTC
 * midnight). Otherwise it is 0.
 *
 * The comparison is `>=` rather than `===` so that a browser clock running a
 * little behind the chain cannot wrongly zero a streak that was just extended.
 */
export function liveStreak(
  storedStreak: number,
  lastCheckInDay: number,
  now: number = Date.now() / 1000,
): number {
  if (storedStreak <= 0) return 0;
  const today = todayIndex(now);
  return lastCheckInDay >= today - 1 ? storedStreak : 0;
}

/** Whether a member can still check in today. */
export function canCheckInToday(lastCheckInDay: number, now: number = Date.now() / 1000): boolean {
  return lastCheckInDay < todayIndex(now);
}

/** "3m ago", "5h ago", "2d ago" — for the feed. */
export function relativeTime(unixSeconds: number, now: number = Date.now() / 1000): string {
  const s = Math.max(0, Math.floor(now - unixSeconds));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < SECONDS_PER_DAY) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / SECONDS_PER_DAY)}d ago`;
}
