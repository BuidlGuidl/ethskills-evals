export const SECONDS_PER_DAY = 86_400;

export function dayFromTimestamp(timestamp: number): number {
  return Math.floor(timestamp / SECONDS_PER_DAY);
}

export function currentUtcDay(now = new Date()): number {
  return Math.floor(now.getTime() / 1000 / SECONDS_PER_DAY);
}

export function monthDayRange(year: number, month: number): { startDay: number; endDay: number } {
  if (!Number.isInteger(year) || year < 1970 || year > 9999) {
    throw new Error("year must be a four digit UTC year");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("month must be between 1 and 12");
  }

  const start = Date.UTC(year, month - 1, 1) / 1000;
  const end = Date.UTC(year, month, 1) / 1000;

  return {
    startDay: dayFromTimestamp(start),
    endDay: dayFromTimestamp(end)
  };
}
