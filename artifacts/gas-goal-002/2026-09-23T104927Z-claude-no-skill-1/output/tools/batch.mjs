/**
 * Client-side helpers for building BatchPay payloads.
 *
 * The packed encoding is 32 bytes per payment: 20-byte recipient || 12-byte amount.
 * Amounts are truncated silently on-chain if they do not fit, so they are validated
 * HERE, before anything is signed.
 */
import { getAddress, concat, pad, toHex } from 'viem'

export const RECORD_SIZE = 32
export const MAX_AMOUNT = (1n << 96n) - 1n

/** Batch size to use by default. Measured savings are flat beyond ~100 (see PLAN.md). */
export const DEFAULT_BATCH_SIZE = 100

export class AmountTooLarge extends Error {
  constructor(amount, index) {
    super(`payment[${index}] amount ${amount} exceeds the 12-byte packed field (max ${MAX_AMOUNT})`)
    this.name = 'AmountTooLarge'
  }
}

/**
 * Encode payments into a BatchPay packed payload.
 * @param {{to: string, amount: bigint}[]} payments
 * @returns {`0x${string}`}
 */
export function packPayments(payments) {
  if (payments.length === 0) throw new Error('refusing to build an empty batch')
  const records = payments.map((p, i) => {
    const amount = BigInt(p.amount)
    if (amount <= 0n) throw new Error(`payment[${i}] amount must be positive`)
    if (amount > MAX_AMOUNT) throw new AmountTooLarge(amount, i)
    // getAddress throws on a malformed or bad-checksum address.
    return concat([getAddress(p.to), pad(toHex(amount), { size: 12 })])
  })
  return concat(records)
}

/** Split a payment list into batches of at most `size`. */
export function chunkPayments(payments, size = DEFAULT_BATCH_SIZE) {
  const out = []
  for (let i = 0; i < payments.length; i += size) out.push(payments.slice(i, i + size))
  return out
}

/**
 * Guard against sending a batch the float cannot cover: a short float would revert
 * the whole batch (strict mode) or skip every payment after the shortfall (lenient).
 */
export function assertFloatCovers(payments, floatBalance) {
  const total = payments.reduce((a, p) => a + BigInt(p.amount), 0n)
  if (total > floatBalance) {
    throw new Error(`batch totals ${total} but the payer holds only ${floatBalance}`)
  }
  return total
}

/** Decode a payload back into payments; used to verify what was actually signed. */
export function unpackPayments(payload) {
  const hex = payload.slice(2)
  if (hex.length % (RECORD_SIZE * 2) !== 0) throw new Error('payload is not a whole number of records')
  const out = []
  for (let i = 0; i < hex.length; i += RECORD_SIZE * 2) {
    const rec = hex.slice(i, i + RECORD_SIZE * 2)
    out.push({ to: getAddress(`0x${rec.slice(0, 40)}`), amount: BigInt(`0x${rec.slice(40)}`) })
  }
  return out
}
