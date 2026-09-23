const SECONDS_PER_DAY = 86_400;

export function utcDayFromTimestamp(timestamp: number): number {
  return Math.floor(timestamp / SECONDS_PER_DAY);
}

export function monthKeyFromTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 7);
}

export function deriveCurrentStreak(
  streakAtLastCheckIn: number,
  lastCheckInDay: number | null,
  nowTimestamp = Math.floor(Date.now() / 1000),
): number {
  if (lastCheckInDay == null) {
    return 0;
  }

  const today = utcDayFromTimestamp(nowTimestamp);
  return lastCheckInDay >= today - 1 ? streakAtLastCheckIn : 0;
}
