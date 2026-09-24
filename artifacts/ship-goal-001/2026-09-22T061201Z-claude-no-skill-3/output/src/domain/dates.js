// Calendar-day helpers. A "day" in Toolshed is a calendar day in the
// association's timezone, represented as a plain 'YYYY-MM-DD' string. Loans
// are due at the end of their due date, so late fees are counted in whole
// calendar days, which is also how a neighbour counts them.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const formatters = new Map();
function formatterFor(timezone) {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatters.set(timezone, formatter);
  }
  return formatter;
}

/** The current calendar day in `timezone`, as 'YYYY-MM-DD'. */
export function today(timezone, now = new Date()) {
  return formatterFor(timezone).format(now);
}

export function isDay(value) {
  const match = DATE_RE.exec(String(value ?? ''));
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return (
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(m) - 1 &&
    date.getUTCDate() === Number(d)
  );
}

export function assertDay(value, label = 'date') {
  if (!isDay(value)) throw new Error(`Invalid ${label}: ${JSON.stringify(value)}`);
  return value;
}

function toUtcMillis(day) {
  const [, y, m, d] = DATE_RE.exec(day);
  return Date.UTC(Number(y), Number(m) - 1, Number(d));
}

/** Whole calendar days from `from` to `to`. Negative if `to` is earlier. */
export function daysBetween(from, to) {
  assertDay(from, 'from date');
  assertDay(to, 'to date');
  return Math.round((toUtcMillis(to) - toUtcMillis(from)) / 86_400_000);
}

export function addDays(day, count) {
  assertDay(day);
  return new Date(toUtcMillis(day) + count * 86_400_000).toISOString().slice(0, 10);
}

/** Human form for the UI: '2026-09-22' -> 'Tue, Sep 22'. */
export function formatDay(day) {
  if (!isDay(day)) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(toUtcMillis(day)));
}

export function nowIso() {
  return new Date().toISOString();
}
