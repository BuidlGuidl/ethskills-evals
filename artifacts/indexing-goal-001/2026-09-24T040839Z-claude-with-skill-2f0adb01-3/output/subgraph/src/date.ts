/**
 * UTC calendar helpers. AssemblyScript has no Date, so the day -> (year, month)
 * conversion is done with Howard Hinnant's civil_from_days algorithm.
 * Input is a UTC day number (unix timestamp / 86400), which is exactly the
 * `dayIndex` the contract emits.
 */

/** Returns the calendar month of a UTC day number, formatted "YYYY-MM". */
export function monthKey(dayIndex: i32): string {
  let z = dayIndex + 719468;
  let era = z / 146097;
  let doe = z - era * 146097; // [0, 146096]
  let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365; // [0, 399]
  let y = yoe + era * 400;
  let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
  let mp = (5 * doy + 2) / 153; // [0, 11]
  let m = mp < 10 ? mp + 3 : mp - 9; // [1, 12]
  if (m <= 2) y += 1;

  let mm = m < 10 ? "0" + m.toString() : m.toString();
  return y.toString() + "-" + mm;
}
