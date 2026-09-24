/**
 * Calendar helpers for the indexer.
 *
 * The contract only knows about UTC day indices (`timestamp / 86400`). The
 * leaderboard is per calendar month, so the mapping has to turn a day index
 * into a "YYYY-MM" bucket. AssemblyScript has no Date formatting worth using,
 * so we do the civil-calendar conversion ourselves.
 */

/**
 * Days-to-civil-date, Howard Hinnant's algorithm. `days` is days since the
 * unix epoch (1970-01-01). Returns [year, month (1-12), day (1-31)].
 */
export function civilFromDays(days: i32): i32[] {
  // Shift the era so that the leap-day lands at the end of a 400-year cycle.
  const z = days + 719468;
  const era = (z >= 0 ? z : z - 146096) / 146097;
  const doe = z - era * 146097; // [0, 146096]
  const yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365; // [0, 399]
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
  const mp = (5 * doy + 2) / 153; // [0, 11], March-based
  const d = doy - (153 * mp + 2) / 5 + 1; // [1, 31]
  const m = mp + (mp < 10 ? 3 : -9); // [1, 12]
  return [m <= 2 ? y + 1 : y, m, d];
}

/** "YYYY-MM" (UTC) for a unix day index. */
export function monthKeyFromDay(day: i32): string {
  const civil = civilFromDays(day);
  const year = civil[0];
  const month = civil[1];
  return year.toString() + "-" + (month < 10 ? "0" : "") + month.toString();
}
