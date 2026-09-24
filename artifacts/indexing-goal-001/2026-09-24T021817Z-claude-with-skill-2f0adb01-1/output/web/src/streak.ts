/**
 * Day/streak arithmetic shared by every screen.
 *
 * The contract measures time in UTC day indices (`timestamp / 86400`), and so
 * does the subgraph. Everything here works in that unit so the UI can never
 * disagree with the chain about which day a check-in landed on.
 */

export const SECONDS_PER_DAY = 86_400;

/** UTC day index for a unix timestamp (defaults to now). */
export function dayIndex(unixSeconds: number = Math.floor(Date.now() / 1000)): number {
  return Math.floor(unixSeconds / SECONDS_PER_DAY);
}

/** "YYYY-MM" (UTC) for a unix timestamp — the leaderboard's month bucket. */
export function monthKey(unixSeconds: number = Math.floor(Date.now() / 1000)): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 7);
}

/** "September 2026" for a "YYYY-MM" key. */
export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The member's *live* streak.
 *
 * The chain only records a streak when someone checks in; nothing is emitted
 * when they stop. So `streakAtLastCheckIn` is a snapshot that goes stale the
 * moment a day is missed, and showing it raw would tell a member they are on a
 * 40-day streak months after they quit. A streak is alive only if the last
 * check-in was today or yesterday (yesterday still counts — today is not over).
 *
 * Mirrors `Streak.currentStreak(address)` in the contract.
 */
export function liveStreak(
  streakAtLastCheckIn: number,
  lastDay: number,
  today: number = dayIndex()
): number {
  if (streakAtLastCheckIn === 0) return 0;
  return lastDay === today || lastDay + 1 === today ? streakAtLastCheckIn : 0;
}

/** Has this member already checked in for the current UTC day? */
export function hasCheckedInToday(lastDay: number, today: number = dayIndex()): boolean {
  return lastDay === today;
}

/** Seconds until the next UTC midnight, i.e. until the streak is at risk. */
export function secondsUntilNextDay(
  unixSeconds: number = Math.floor(Date.now() / 1000)
): number {
  return SECONDS_PER_DAY - (unixSeconds % SECONDS_PER_DAY);
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function timeAgo(unixSeconds: number, now: number = Date.now() / 1000): string {
  const seconds = Math.max(0, Math.floor(now - unixSeconds));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
