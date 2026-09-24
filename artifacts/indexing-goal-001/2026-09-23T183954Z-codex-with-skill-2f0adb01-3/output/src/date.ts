const SECONDS_PER_DAY = 86_400;

export function unixSecondsToUtcDay(timestamp: bigint | number): number {
  return Math.floor(Number(timestamp) / SECONDS_PER_DAY);
}

export function unixSecondsToMonthKey(timestamp: bigint | number): string {
  const date = new Date(Number(timestamp) * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

export function currentUtcDay(now = new Date()): number {
  return Math.floor(now.getTime() / (SECONDS_PER_DAY * 1000));
}

export function currentMonthKey(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

export function effectiveCurrentStreak(
  streakAtLastCheckIn: number,
  lastCheckInDay: number,
  todayDay: number,
): number {
  return lastCheckInDay >= todayDay - 1 ? streakAtLastCheckIn : 0;
}

export function isMonthKey(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
