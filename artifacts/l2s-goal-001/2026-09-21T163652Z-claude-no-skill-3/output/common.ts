// Shared config, constants and journal helpers for payout.ts and sweep.ts.
//
// Every address below was checked on-chain on 2026-09-21 (see NOTES.md,
// "Pinned addresses"). They are pinned here on purpose: the scripts refuse to
// run if the chain disagrees, rather than trusting an env var that a typo can
// silently redirect.

import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, writeSync } from 'node:fs'
import { type Address, type Hex, getAddress, isAddress, zeroAddress } from 'viem'
import { type LocalAccount, privateKeyToAccount } from 'viem/accounts'

export const CELO_CHAIN_ID = 42_220
export const ETH_CHAIN_ID = 1

/** Circle-native USDC on Celo (FiatTokenV2_2, 6 decimals). NOT the Wormhole
 *  bridged "USDC" at 0x37f750B7cC259A2f741AF45294f6a16572CF5cAd, which also
 *  reports symbol() == "USDC". */
export const USDC_CELO: Address = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C'
export const USDC_DECIMALS = 6

/** Celo's L1 (Ethereum mainnet) contracts: docs.celo.org/tooling/contracts/l1-contracts */
export const CELO_L1 = {
  optimismPortal: '0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC',
  disputeGameFactory: '0xFbAC162162f4009Bb007C6DeBC36B1dAC10aF683',
  systemConfig: '0x89E31965D844a309231B1f17759Ccaf1b7c09861',
  /** CELO as an ERC-20 on Ethereum. This is what the treasury receives. */
  celoToken: '0x057898f3C43F129a17517B9056D23851F124b19f',
} as const satisfies Record<string, Address>

const PLACEHOLDER_ADDRESSES = new Set(
  ['0x1111111111111111111111111111111111111111', zeroAddress].map((a) => a.toLowerCase()),
)

export function env(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) die(`Missing required env var ${name} (see NOTES.md)`)
  return v
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined
}

/** Strict address parse: rejects bad checksums on mixed-case input. */
export function parseAddress(raw: string, what: string): Address {
  const s = raw.trim()
  if (!isAddress(s, { strict: true })) die(`${what}: "${raw}" is not a valid address (or has a bad checksum)`)
  return getAddress(s)
}

export function assertNotPlaceholder(addr: Address, what: string) {
  if (PLACEHOLDER_ADDRESSES.has(addr.toLowerCase()))
    die(`${what} is still the placeholder ${addr}. Set the real address before running.`)
}

/**
 * Loads the ops signer. The private key comes from OPS_PRIVATE_KEY; in
 * production inject it from your secret manager at run time, never from a
 * committed .env. To use a KMS/HSM signer instead, return any viem
 * LocalAccount from here; nothing else needs to change.
 */
export function loadAccount(varName: string): LocalAccount {
  const key = env(varName)
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) die(`${varName} must be a 0x-prefixed 32-byte hex private key`)
  return privateKeyToAccount(key as Hex)
}

export function die(msg: string): never {
  console.error(`\nERROR: ${msg}\n`)
  process.exit(1)
}

export function parseArgs(argv: string[]) {
  const positional: string[] = []
  const flags: Record<string, string | true> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a.startsWith('--')) {
      const [k, inline] = a.slice(2).split('=', 2) as [string, string | undefined]
      if (inline !== undefined) flags[k] = inline
      else if (argv[i + 1] && !argv[i + 1]!.startsWith('--')) flags[k] = argv[++i]!
      else flags[k] = true
    } else positional.push(a)
  }
  return { positional, flags }
}

// ---------------------------------------------------------------------------
// Journal: a JSON file written atomically (tmp + fsync + rename) *before* any
// transaction is broadcast, so a crash at any point can be resumed without
// paying anyone twice. Journals are the audit trail: archive them, don't delete.
// ---------------------------------------------------------------------------

const bigintReplacer = (_k: string, v: unknown) => (typeof v === 'bigint' ? `${v}n` : v)
const bigintReviver = (_k: string, v: unknown) =>
  typeof v === 'string' && /^-?\d+n$/.test(v) ? BigInt(v.slice(0, -1)) : v

export function readJournal<T>(path: string): T | undefined {
  if (!existsSync(path)) return undefined
  return JSON.parse(readFileSync(path, 'utf8'), bigintReviver) as T
}

export function writeJournal(path: string, data: unknown) {
  const tmp = `${path}.tmp`
  const fd = openSync(tmp, 'w')
  try {
    writeSync(fd, JSON.stringify(data, bigintReplacer, 2))
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  renameSync(tmp, path)
}
