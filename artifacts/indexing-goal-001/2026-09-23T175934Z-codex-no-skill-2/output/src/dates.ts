export const SECONDS_PER_DAY = 24 * 60 * 60;

export function dayFromDate(date: Date): number {
  return Math.floor(date.getTime() / 1000 / SECONDS_PER_DAY);
}

export function isoFromUnix(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

export function parseMonth(month: string): { startDay: number; endDay: number } {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("month must be YYYY-MM");
  }

  const [year, monthIndex] = month.split("-").map(Number);
  const start = Date.UTC(year, monthIndex - 1, 1) / 1000 / SECONDS_PER_DAY;
  const end = Date.UTC(year, monthIndex, 1) / 1000 / SECONDS_PER_DAY;
  return { startDay: start, endDay: end };
}

export function currentUtcMonth(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}
