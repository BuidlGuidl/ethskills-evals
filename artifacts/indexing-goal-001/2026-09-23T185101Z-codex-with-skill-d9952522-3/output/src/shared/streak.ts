const DAY_MS = 24 * 60 * 60 * 1000;

export function dayNumberFromDate(date: Date): number {
  return Math.floor(date.getTime() / DAY_MS);
}

export function monthStartFromDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function parseMonthStart(month?: string, now = new Date()): string {
  if (!month) {
    return monthStartFromDate(now);
  }

  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("month must use YYYY-MM format");
  }

  const [year, monthNumber] = month.split("-").map(Number);
  if (monthNumber < 1 || monthNumber > 12) {
    throw new Error("month must use YYYY-MM format");
  }

  return `${year}-${String(monthNumber).padStart(2, "0")}-01`;
}

export function activeCurrentStreak(params: {
  storedCurrentStreak: number;
  lastCheckInDay: number | bigint | null;
  now?: Date;
}): number {
  if (params.lastCheckInDay === null) {
    return 0;
  }

  const today = dayNumberFromDate(params.now ?? new Date());
  const lastDay = Number(params.lastCheckInDay);
  return lastDay >= today - 1 ? params.storedCurrentStreak : 0;
}
