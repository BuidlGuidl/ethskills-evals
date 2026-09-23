const SECONDS_PER_DAY = 86_400;

export function dayFromUnixTimestamp(timestamp: number): number {
  return Math.floor(timestamp / SECONDS_PER_DAY);
}

export function monthFromUnixTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 7);
}

export function activeCurrentStreak(
  streakThroughLastCheckIn: number,
  lastCheckInDay: number,
  currentDay: number,
): number {
  return lastCheckInDay >= currentDay - 1 ? streakThroughLastCheckIn : 0;
}

export function currentUtcMonth(): string {
  return monthFromUnixTimestamp(Math.floor(Date.now() / 1000));
}

export function currentUtcDay(): number {
  return dayFromUnixTimestamp(Math.floor(Date.now() / 1000));
}
