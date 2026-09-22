import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { getAddress, isAddress, type Address } from 'viem'
import { db, now } from './db'
import { publicClient } from './chainClient'

/**
 * Sign-in with Ethereum, kept small.
 *
 * Every write in this app is attributable to an address: listings, borrow
 * requests, signed offers. So the browser proves control of the address once by
 * signing a nonce, and we hand back an HMAC-signed cookie. There are no
 * passwords and no accounts table to leak.
 */

const COOKIE = 'toolshed_session'
const SESSION_TTL = 60 * 60 * 24 * 30 // 30 days
const NONCE_TTL = 60 * 10

function secret(): Buffer {
  const value = process.env.SESSION_SECRET
  if (!value || value.length < 32) {
    throw new Error('SESSION_SECRET must be set to at least 32 characters (see .env.example)')
  }
  return Buffer.from(value, 'utf8')
}

export function issueNonce(): string {
  const nonce = randomBytes(16).toString('hex')
  const database = db()
  database.prepare('INSERT INTO auth_nonces (nonce, created_at) VALUES (?, ?)').run(nonce, now())
  database.prepare('DELETE FROM auth_nonces WHERE created_at < ?').run(now() - NONCE_TTL)
  return nonce
}

/** Consumes the nonce so a captured signature cannot be replayed. */
function consumeNonce(nonce: string): boolean {
  const result = db()
    .prepare('DELETE FROM auth_nonces WHERE nonce = ? AND created_at >= ?')
    .run(nonce, now() - NONCE_TTL)
  return result.changes === 1
}

export function signInMessage(address: string, nonce: string, host: string): string {
  return [
    `${host} wants you to sign in with your Ethereum account:`,
    address,
    '',
    'Sign in to Toolshed, the neighbourhood tool library.',
    '',
    `Nonce: ${nonce}`,
  ].join('\n')
}

export async function verifySignIn(params: {
  address: string
  nonce: string
  host: string
  signature: `0x${string}`
}): Promise<Address> {
  if (!isAddress(params.address)) throw new Error('Not an address')
  const address = getAddress(params.address)
  if (!consumeNonce(params.nonce)) throw new Error('Unknown or expired nonce')

  // verifyMessage handles both EOAs and ERC-1271 smart wallets (Base Account).
  const valid = await publicClient.verifyMessage({
    address,
    message: signInMessage(address, params.nonce, params.host),
    signature: params.signature,
  })
  if (!valid) throw new Error('Bad signature')

  db()
    .prepare(
      'INSERT INTO members (address, created_at) VALUES (?, ?) ON CONFLICT(address) DO NOTHING',
    )
    .run(address, now())

  return address
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function sessionCookie(address: Address): {
  name: string
  value: string
  options: Record<string, unknown>
} {
  const payload = Buffer.from(JSON.stringify({ address, exp: now() + SESSION_TTL })).toString(
    'base64url',
  )
  return {
    name: COOKIE,
    value: `${payload}.${sign(payload)}`,
    options: {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_TTL,
    },
  }
}

export function readSessionValue(value: string | undefined): Address | undefined {
  if (!value) return undefined
  const [payload, mac] = value.split('.')
  if (!payload || !mac) return undefined
  const expected = sign(payload)
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return undefined
  try {
    const { address, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (typeof exp !== 'number' || exp < now()) return undefined
    return getAddress(address)
  } catch {
    return undefined
  }
}

/** The signed-in address, or undefined. Use in server components and route handlers. */
export async function currentMember(): Promise<Address | undefined> {
  const store = await cookies()
  return readSessionValue(store.get(COOKIE)?.value)
}

export async function requireMember(): Promise<Address> {
  const address = await currentMember()
  if (!address) throw new HttpError(401, 'Sign in first')
  return address
}

export const sessionCookieName = COOKIE

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}
