import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import { verifyMessage, type Address, getAddress } from 'viem'

/**
 * Binding an API key to an address.
 *
 * The contract answers "is this address subscribed". It cannot answer "is this
 * HTTP request from that address" -- nothing in a request proves that, and a
 * plain `X-Wallet-Address` header would let anyone bill against a stranger's
 * subscription. So a customer signs a one-off enrolment message with the key
 * that controls the subscribed address, and gets back an API key bound to it.
 *
 * Keys are stored hashed, so a leak of this table does not hand out working
 * credentials. Swap the Map for your real database; the interface is the point.
 */

const ENROLMENT_TTL_MS = 10 * 60_000

export function enrolmentMessage(address: Address, nonce: string, issuedAt: number): string {
  return [
    'weather-api.example: link this address to an API key',
    `Address: ${getAddress(address)}`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date(issuedAt).toISOString()}`,
  ].join('\n')
}

type KeyRecord = { address: Address; createdAt: number; lastSeenAt: number }

export class ApiKeyStore {
  private readonly byHash = new Map<string, KeyRecord>()
  private readonly nonces = new Map<string, number>()

  /** Hand out a nonce for the client to sign. Single use, short lived. */
  issueNonce(): { nonce: string; issuedAt: number } {
    const nonce = randomBytes(16).toString('hex')
    const issuedAt = Date.now()
    this.nonces.set(nonce, issuedAt)
    return { nonce, issuedAt }
  }

  /**
   * Verify the signature and mint an API key for the signing address.
   * Returns the plaintext key exactly once; only its hash is retained.
   */
  async enrol(address: Address, nonce: string, signature: `0x${string}`): Promise<string> {
    const issuedAt = this.nonces.get(nonce)
    if (issuedAt === undefined) throw new Error('unknown or already-used nonce')
    this.nonces.delete(nonce) // burn it whatever happens next
    if (Date.now() - issuedAt > ENROLMENT_TTL_MS) throw new Error('nonce expired')

    const ok = await verifyMessage({
      address,
      message: enrolmentMessage(address, nonce, issuedAt),
      signature,
    })
    if (!ok) throw new Error('signature does not match address')

    const key = `wx_${randomBytes(24).toString('base64url')}`
    this.byHash.set(hashKey(key), {
      address: getAddress(address),
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    })
    return key
  }

  /** Resolve an incoming API key to the address it is bound to. */
  resolve(key: string | undefined): Address | null {
    if (!key) return null
    const record = this.byHash.get(hashKey(key))
    if (!record) return null
    record.lastSeenAt = Date.now()
    return record.address
  }

  revoke(key: string): boolean {
    return this.byHash.delete(hashKey(key))
  }

  /** Housekeeping: drop nonces nobody used. */
  sweepNonces(now = Date.now()): void {
    for (const [nonce, issuedAt] of this.nonces) {
      if (now - issuedAt > ENROLMENT_TTL_MS) this.nonces.delete(nonce)
    }
  }
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/** Constant-time compare, for callers that need to match a key directly. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}
