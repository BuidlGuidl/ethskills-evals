import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { createPublicClient, http, getAddress, verifyMessage } from 'viem'

/**
 * Binds an API key to an address.
 *
 * The contract answers "is this address subscribed". It cannot answer "is the person
 * holding this HTTP connection that address" — so the customer signs a short login
 * message once, and gets back an API key they can paste into a curl command or a hobby
 * project. The key is an HMAC of the address under a server secret: stateless to verify,
 * and revocable en masse by rotating the secret.
 *
 * Signature verification goes through `verifyMessage`, which falls back to ERC-1271 for
 * smart-contract wallets, so Safe and passkey-account customers work too.
 */
export class ApiKeyIssuer {
  /**
   * @param {object} opts
   * @param {string} opts.secret           server secret; rotate to revoke every key at once
   * @param {string} opts.rpcUrl           needed for ERC-1271 smart-account signatures
   * @param {import('viem').Chain} [opts.chain]
   * @param {number} [opts.nonceTtlMs]     how long a login challenge stays valid (default 5 min)
   */
  constructor({ secret, rpcUrl, chain, nonceTtlMs = 5 * 60_000 }) {
    if (!secret || secret.length < 32) {
      throw new Error('ApiKeyIssuer: secret must be at least 32 characters')
    }
    this.secret = secret
    this.nonceTtlMs = nonceTtlMs
    this.client = createPublicClient({ chain, transport: http(rpcUrl) })
    /** @type {Map<string, number>} nonce -> issuedAt. Swap for Redis when you run >1 process. */
    this.nonces = new Map()
    /** @type {Map<string, string>} key prefix -> address. Persist this in your database;
     *  in memory it is lost on restart and customers have to sign in again. */
    this.knownPrefixes = new Map()
  }

  /** Issue a one-time challenge for the customer to sign. */
  challenge(address) {
    const nonce = randomBytes(16).toString('hex')
    this.nonces.set(nonce, Date.now())
    this._sweepNonces()
    return { nonce, message: loginMessage(getAddress(address), nonce) }
  }

  /** Verify a signed challenge and return an API key bound to the address. */
  async redeem({ address, nonce, signature }) {
    const issuedAt = this.nonces.get(nonce)
    if (issuedAt === undefined) throw new Error('unknown or already-used nonce')
    if (Date.now() - issuedAt > this.nonceTtlMs) {
      this.nonces.delete(nonce)
      throw new Error('challenge expired')
    }
    this.nonces.delete(nonce) // single use, so a leaked signature cannot be replayed

    const account = getAddress(address)
    const ok = await verifyMessage({
      address: account,
      message: loginMessage(account, nonce),
      signature,
      client: this.client, // viem uses this for the ERC-1271 smart-account fallback
    }).catch(() => false)
    if (!ok) throw new Error('bad signature')

    this.remember(account)
    return { apiKey: this.keyFor(account), address: account }
  }

  /** @returns {string} the API key for an address. */
  keyFor(address) {
    const account = getAddress(address)
    // Hex, not base64url: the key is parsed by splitting on '_', which base64url can contain.
    const mac = createHmac('sha256', this.secret).update(account).digest('hex')
    return `wk_${account.slice(2, 10).toLowerCase()}_${mac}`
  }

  /**
   * Recover the address an API key was issued to, or null if the key is unknown or forged.
   * The comparison is constant time, so keys cannot be brute-forced a byte at a time.
   */
  addressFor(apiKey) {
    if (typeof apiKey !== 'string') return null
    const parts = apiKey.split('_')
    if (parts.length !== 3 || parts[0] !== 'wk') return null
    const candidate = this.knownPrefixes.get(parts[1])
    if (!candidate) return null
    return this.verify(apiKey, candidate) ? candidate : null
  }

  /** Record an address so `addressFor` can resolve its keys. Persist this in your database. */
  remember(address) {
    const account = getAddress(address)
    this.knownPrefixes.set(account.slice(2, 10).toLowerCase(), account)
    return account
  }

  /** Constant-time check that `apiKey` really belongs to `address`. */
  verify(apiKey, address) {
    let expected
    try {
      expected = this.keyFor(address)
    } catch {
      return false
    }
    const a = Buffer.from(String(apiKey))
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
  }

  _sweepNonces() {
    const cutoff = Date.now() - this.nonceTtlMs
    for (const [nonce, at] of this.nonces) {
      if (at < cutoff) this.nonces.delete(nonce)
    }
  }
}

/** The exact text a customer signs. Changing it invalidates in-flight challenges. */
function loginMessage(account, nonce) {
  return [
    'Sign in to the Weather API.',
    '',
    `Address: ${account}`,
    `Nonce: ${nonce}`,
    'This signature costs no gas and authorises no transactions.',
  ].join('\n')
}
