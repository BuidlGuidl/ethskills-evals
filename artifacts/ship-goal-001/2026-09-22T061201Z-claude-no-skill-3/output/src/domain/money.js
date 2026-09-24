// USDC has 6 decimals. Every amount in Toolshed is an integer number of
// micro-USDC (1 USDC = 1_000_000). Nothing is ever a float: a deposit split
// between a late fee and a refund has to add back up to exactly the deposit.

export const MICRO = 1_000_000n;

/** Parse a human amount ("12", "12.50") into micro-USDC. Throws on garbage. */
export function parseUsdc(input) {
  const text = String(input ?? '').trim();
  if (!/^\d{1,9}(\.\d{1,6})?$/.test(text)) {
    throw new Error(`Not a valid USDC amount: ${JSON.stringify(input)}`);
  }
  const [whole, fraction = ''] = text.split('.');
  const padded = fraction.padEnd(6, '0');
  return BigInt(whole) * MICRO + BigInt(padded);
}

/** Format micro-USDC for display: 12500000n -> "12.50". */
export function formatUsdc(micros) {
  const value = BigInt(micros);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / MICRO;
  const fraction = (abs % MICRO).toString().padStart(6, '0').replace(/0+$/, '');
  const decimals = fraction.length <= 2 ? fraction.padEnd(2, '0') : fraction;
  return `${negative ? '-' : ''}${whole}.${decimals}`;
}

/** SQLite stores these as TEXT so we never lose precision through a double. */
export function toStorage(micros) {
  return BigInt(micros).toString();
}

export function fromStorage(text) {
  return BigInt(text ?? '0');
}

export function min(a, b) {
  return a < b ? a : b;
}
