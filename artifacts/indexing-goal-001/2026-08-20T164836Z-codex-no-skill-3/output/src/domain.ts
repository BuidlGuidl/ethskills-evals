export const SECONDS_PER_DAY = 86_400;

export type CheckIn = {
  member: string;
  day: number;
  timestamp: number;
  note: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
};

/** Calculates a UTC-day streak ending today or yesterday; older history cannot extend it. */
export function currentStreak(daysDescending: number[], nowSeconds: number): number {
  const today = Math.floor(nowSeconds / SECONDS_PER_DAY);
  let expected = today;
  let count = 0;

  for (const day of daysDescending) {
    if (day === expected) {
      count++;
      expected--;
    } else if (count === 0 && day === today - 1) {
      count++;
      expected = day - 1;
    } else if (day < expected) {
      break;
    }
  }
  return count;
}

export function utcMonthBounds(nowSeconds: number): { startDay: number; endDay: number } {
  const now = new Date(nowSeconds * 1_000);
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1_000;
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) / 1_000;
  return { startDay: Math.floor(start / SECONDS_PER_DAY), endDay: Math.floor(end / SECONDS_PER_DAY) };
}
