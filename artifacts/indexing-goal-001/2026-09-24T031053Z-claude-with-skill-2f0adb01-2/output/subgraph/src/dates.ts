import { BigInt } from "@graphprotocol/graph-ts";

/**
 * Calendar helpers for UTC day indices (Unix day numbers), which is the unit the
 * contract counts in. Pure integer math — no Date, which AssemblyScript's
 * graph-ts runtime does not give us.
 *
 * Algorithm: Howard Hinnant's `civil_from_days`.
 */
export class Civil {
  year: i32;
  month: i32;
  day: i32;

  constructor(year: i32, month: i32, day: i32) {
    this.year = year;
    this.month = month;
    this.day = day;
  }
}

export function civilFromDays(days: i32): Civil {
  let z = days + 719468;
  let era = (z >= 0 ? z : z - 146096) / 146097;
  let doe = z - era * 146097; // [0, 146096]
  let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365; // [0, 399]
  let y = yoe + era * 400;
  let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
  let mp = (5 * doy + 2) / 153; // [0, 11]
  let d = doy - (153 * mp + 2) / 5 + 1; // [1, 31]
  let m = mp + (mp < 10 ? 3 : -9); // [1, 12]
  return new Civil(y + (m <= 2 ? 1 : 0), m, d);
}

function pad2(n: i32): string {
  return n < 10 ? "0" + n.toString() : n.toString();
}

/** UTC day index -> "YYYY-MM-DD". */
export function dateKey(days: i32): string {
  let c = civilFromDays(days);
  return c.year.toString() + "-" + pad2(c.month) + "-" + pad2(c.day);
}

/** UTC day index -> "YYYY-MM". */
export function monthKey(days: i32): string {
  let c = civilFromDays(days);
  return c.year.toString() + "-" + pad2(c.month);
}

export function dayFromTimestamp(timestamp: BigInt): i32 {
  return timestamp.div(BigInt.fromI32(86400)).toI32();
}
