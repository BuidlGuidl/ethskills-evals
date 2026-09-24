/**
 * Packed payout encoding: one 32-byte word per payout,
 *   address recipient (20 bytes) || uint96 amount (12 bytes)
 *
 * This is the same 32 bytes a lone ABI-encoded `address` would take, so the
 * amount costs nothing extra. It also skips the offset/length words and the
 * per-element bounds checks that `address[] , uint256[]` would cost.
 */

export const MAX_AMOUNT = (1n << 96n) - 1n;

/** @typedef {{ to: `0x${string}`, amount: bigint }} Payout */

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * @param {Payout[]} payouts
 * @returns {`0x${string}`} packed blob, 32 bytes per payout
 */
export function encodePayouts(payouts) {
  let out = '0x';
  for (let i = 0; i < payouts.length; i++) {
    const { to, amount } = payouts[i];
    if (!ADDR_RE.test(to)) throw new Error(`payout[${i}]: bad address ${to}`);
    if (typeof amount !== 'bigint') throw new Error(`payout[${i}]: amount must be a bigint`);
    if (amount <= 0n) throw new Error(`payout[${i}]: amount must be positive`);
    if (amount > MAX_AMOUNT) throw new Error(`payout[${i}]: amount ${amount} exceeds uint96`);
    out += to.slice(2).toLowerCase() + amount.toString(16).padStart(24, '0');
  }
  return /** @type {`0x${string}`} */ (out);
}

/** Inverse of {@link encodePayouts}; used by tests and the preflight decoder. */
export function decodePayouts(blob) {
  const hex = blob.slice(2);
  if (hex.length % 64 !== 0) throw new Error('blob is not a whole number of 32-byte words');
  const out = [];
  for (let i = 0; i < hex.length; i += 64) {
    out.push({
      to: /** @type {`0x${string}`} */ ('0x' + hex.slice(i, i + 40)),
      amount: BigInt('0x' + hex.slice(i + 40, i + 64)),
    });
  }
  return out;
}
