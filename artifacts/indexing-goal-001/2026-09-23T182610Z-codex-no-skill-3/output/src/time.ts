export const DAY_SECONDS = 86_400;

export function unixSecondsToDay(unixSeconds: number): number {
  return Math.floor(unixSeconds / DAY_SECONDS);
}

export function dayToDateString(day: number): string {
  return new Date(day * DAY_SECONDS * 1000).toISOString().slice(0, 10);
}

export function dateStringToDay(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Expected YYYY-MM-DD date, got "${date}"`);
  }

  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(timestamp)) {
    throw new Error(`Invalid date "${date}"`);
  }

  return Math.floor(timestamp / 1000 / DAY_SECONDS);
}

export function currentUtcDay(now = new Date()): number {
  return unixSecondsToDay(Math.floor(now.getTime() / 1000));
}

export function currentMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export function monthBounds(month: string): { startDay: number; endDay: number } {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error(`Expected YYYY-MM month, got "${month}"`);
  }

  const start = Date.parse(`${month}-01T00:00:00.000Z`);
  if (Number.isNaN(start)) {
    throw new Error(`Invalid month "${month}"`);
  }

  const startDate = new Date(start);
  const endDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1));

  return {
    startDay: Math.floor(startDate.getTime() / 1000 / DAY_SECONDS),
    endDay: Math.floor(endDate.getTime() / 1000 / DAY_SECONDS),
  };
}

export function calculateCurrentStreak(daysDescending: number[], now = new Date()): number {
  if (daysDescending.length === 0) {
    return 0;
  }

  const today = currentUtcDay(now);
  const newestDay = daysDescending[0];

  if (newestDay < today - 1) {
    return 0;
  }

  let streak = 1;
  let expectedDay = newestDay - 1;

  for (const day of daysDescending.slice(1)) {
    if (day !== expectedDay) {
      break;
    }

    streak += 1;
    expectedDay -= 1;
  }

  return streak;
}
