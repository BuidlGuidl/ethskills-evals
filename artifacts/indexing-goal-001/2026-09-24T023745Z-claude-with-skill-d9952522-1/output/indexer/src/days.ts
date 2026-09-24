/**
 * Day math, shared by the indexing handlers and the API.
 *
 * The contract buckets time into day indices (`(unixSeconds + offset) / 86400`)
 * and emits that index on every check-in, so the read side never re-derives a
 * day from a timestamp — it reuses the contract's own number. The offset is
 * fixed at deploy; it lives here so a UI can convert an index back to a date.
 */
export const SECONDS_PER_DAY = 86_400;

/** Must match the `dayOffsetSeconds` the contract was deployed with. */
export const DAY_OFFSET_SECONDS = Number(process.env.DAY_OFFSET_SECONDS ?? 0);

/** Unix seconds at which day `day` begins. */
export function dayStart(day: number): number {
  return day * SECONDS_PER_DAY - DAY_OFFSET_SECONDS;
}

/** The day index a unix timestamp falls in. */
export function dayOf(unixSeconds: number): number {
  return Math.floor((unixSeconds + DAY_OFFSET_SECONDS) / SECONDS_PER_DAY);
}

/** The day index right now, by wall clock. */
export function today(): number {
  return dayOf(Math.floor(Date.now() / 1000));
}

/** The calendar month a day index belongs to, as `YYYY-MM`. */
export function monthOf(day: number): string {
  const d = new Date(dayStart(day) * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** ISO date (`YYYY-MM-DD`) a day index corresponds to. */
export function dateOf(day: number): string {
  return new Date(dayStart(day) * 1000).toISOString().slice(0, 10);
}

/** The current `YYYY-MM`, on the same clock the contract uses. */
export function currentMonth(): string {
  return monthOf(today());
}

/**
 * A member's streak as of `asOfDay`.
 *
 * `streakAtLastCheckIn` is what the contract emitted on their most recent
 * check-in and is only true for that day: once a whole day is missed the streak
 * is broken, and no transaction is sent to record that. The decay has to be
 * applied at read time or every lapsed member's profile shows a frozen streak.
 */
export function liveStreak(
  lastDay: number | null | undefined,
  streakAtLastCheckIn: number,
  asOfDay: number,
): number {
  if (lastDay === null || lastDay === undefined) return 0;
  if (lastDay === asOfDay || lastDay === asOfDay - 1) return streakAtLastCheckIn;
  return 0;
}
