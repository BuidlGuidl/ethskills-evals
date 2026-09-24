const MS_PER_DAY = 86_400_000;

export function utcDayFromUnixSeconds(timestamp: bigint | number): number {
  return Math.floor(Number(timestamp) / 86_400);
}

export function currentUtcDay(now = new Date()): number {
  return Math.floor(now.getTime() / MS_PER_DAY);
}

export function monthKeyFromUnixSeconds(timestamp: bigint | number): string {
  const date = new Date(Number(timestamp) * 1000);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

export function isValidMonthKey(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function activeCurrentStreak(storedCurrentStreak: number, lastCheckInDay: number | null, today = currentUtcDay()): number {
  if (lastCheckInDay === null) return 0;
  return lastCheckInDay >= today - 1 ? storedCurrentStreak : 0;
}

