import {verifyMessage, isAddress, getAddress, type Address} from 'viem'

/**
 * Resolving "who is calling" is separate from "are they subscribed", and it is the part the chain
 * cannot do for you. Two options are wired up here:
 *
 *  1. A signed header. The caller signs a short, time-boxed message with the same key that holds
 *    the subscription. Nothing to store, nothing to leak, and it proves control of the address.
 *  2. An API key you issued, looked up against an address in your own database. Friendlier for a
 *    hobbyist dropping a key into a script, at the cost of having a secret to manage.
 *
 * Both end at the same place: an Address to hand to the gate.
 */

export const AUTH_WINDOW_SECONDS = 300

/** The exact string a client must sign. Pinning the host stops a signature for one service being replayed at another. */
export function challenge(host: string, timestamp: number): string {
  return `${host} wants you to authenticate.\nAddress-bound API access.\nTimestamp: ${timestamp}`
}

export type AuthResult = {ok: true; address: Address} | {ok: false; reason: string}

export async function authenticateSignature(
  host: string,
  address: string | undefined,
  signature: string | undefined,
  timestamp: string | undefined,
  seenNonces: Set<string>,
): Promise<AuthResult> {
  if (!address || !signature || !timestamp) {
    return {ok: false, reason: 'missing X-Address, X-Timestamp or X-Signature'}
  }
  if (!isAddress(address)) return {ok: false, reason: 'X-Address is not an address'}

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return {ok: false, reason: 'X-Timestamp is not a number'}

  const skew = Math.abs(Math.floor(Date.now() / 1000) - ts)
  if (skew > AUTH_WINDOW_SECONDS) {
    return {ok: false, reason: `X-Timestamp outside the ${AUTH_WINDOW_SECONDS}s window`}
  }

  // Within the window a signature is single-use, so a captured header cannot be replayed even
  // before it expires.
  const nonce = `${address.toLowerCase()}:${ts}:${signature}`
  if (seenNonces.has(nonce)) return {ok: false, reason: 'signature already used'}

  const valid = await verifyMessage({
    address: getAddress(address),
    message: challenge(host, ts),
    signature: signature as `0x${string}`,
  })
  if (!valid) return {ok: false, reason: 'bad signature'}

  seenNonces.add(nonce)
  return {ok: true, address: getAddress(address)}
}

/**
 * Bounded replay cache. Entries only need to outlive the auth window, so a periodic full clear is
 * enough and costs nothing — the alternative is an unbounded Set that becomes the leak.
 */
export class NonceCache {
  private current = new Set<string>()
  private previous = new Set<string>()

  constructor(rotateMs = AUTH_WINDOW_SECONDS * 1000) {
    const timer = setInterval(() => {
      this.previous = this.current
      this.current = new Set()
    }, rotateMs)
    timer.unref?.()
  }

  has(n: string): boolean {
    return this.current.has(n) || this.previous.has(n)
  }

  add(n: string): void {
    this.current.add(n)
  }

  /** Adapter so this can be passed where a Set is expected. */
  asSet(): Set<string> {
    return this as unknown as Set<string>
  }
}
