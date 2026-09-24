// Shared config, safety checks and journaling for payout.ts and sweep.ts.
//
// Every address below was checked against the live chains on 2026-09-21.
// See NOTES.md ("Addresses") for how they were verified. Re-verify them if
// Celo announces an L1 contract upgrade.

import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, unlinkSync, writeSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import {
  type Address,
  type Chain,
  type Hex,
  getAddress,
  isAddress,
  zeroAddress,
} from 'viem'
import { type LocalAccount, privateKeyToAccount } from 'viem/accounts'
import { celo, mainnet } from 'viem/chains'

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

/** Native Circle USDC on Celo (6 decimals). NOT the Wormhole USDC.e at
 *  0x37f750B7cC259A2f741AF45294f6a16572CF5cAd, which also reports symbol "USDC". */
export const USDC_CELO: Address = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C'

/** Celo's OP Stack contracts on Ethereum mainnet. */
export const CELO_L1 = {
  optimismPortal: '0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC',
  disputeGameFactory: '0xFbAC162162f4009Bb007C6DeBC36B1dAC10aF683',
  systemConfig: '0x89E31965D844a309231B1f17759Ccaf1b7c09861',
  /** What the treasury actually receives: ERC-20 CELO locked in the portal. */
  celoToken: '0x057898f3C43F129a17517B9056D23851F124b19f',
} as const satisfies Record<string, Address>

/** OP Stack predeploy on Celo that native-CELO withdrawals go through. */
export const L2_TO_L1_MESSAGE_PASSER: Address = '0x4200000000000000000000000000000000000016'

/** The placeholder from the spec. Scripts refuse to send funds to it. */
export const PLACEHOLDER_TREASURY: Address = '0x1111111111111111111111111111111111111111'

/** viem's `celo` chain plus the L1 contracts that viem's op-stack actions need. */
export const celoL2: Chain = {
  ...celo,
  contracts: {
    ...celo.contracts,
    portal: { [mainnet.id]: { address: CELO_L1.optimismPortal } },
    disputeGameFactory: { [mainnet.id]: { address: CELO_L1.disputeGameFactory } },
  },
}

// ---------------------------------------------------------------------------
// Env / CLI
// ---------------------------------------------------------------------------

export function env(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) die(`missing required env var ${name} (see NOTES.md)`)
  return v
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined
}

export function loadAccount(envName: string): LocalAccount {
  const key = env(envName)
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) die(`${envName} must be a 0x-prefixed 32-byte hex private key`)
  return privateKeyToAccount(key as Hex)
}

/** Parse an address strictly: a mixed-case address must have a valid EIP-55 checksum. */
export function parseAddress(raw: string, what: string): Address {
  const s = raw.trim()
  if (!isAddress(s, { strict: true })) die(`${what}: "${s}" is not a valid address (bad hex or bad checksum)`)
  const a = getAddress(s)
  if (a === zeroAddress) die(`${what}: zero address`)
  return a
}

export function parseFlags(argv: string[]): { positional: string[]; flags: Map<string, string | true> } {
  const positional: string[] = []
  const flags = new Map<string, string | true>()
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) { positional.push(a); continue }
    const [k, inline] = a.slice(2).split('=', 2)
    if (inline !== undefined) flags.set(k, inline)
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) flags.set(k, argv[++i])
    else flags.set(k, true)
  }
  return { positional, flags }
}

export function die(msg: string): never {
  console.error(`\nERROR: ${msg}\n`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Chain checks
// ---------------------------------------------------------------------------

/** Guard against an RPC URL that points at the wrong network (e.g. a testnet). */
export async function assertChainId(client: { getChainId(): Promise<number> }, expected: number, label: string) {
  const actual = await client.getChainId()
  if (actual !== expected) die(`${label} RPC is on chain ${actual}, expected ${expected}`)
}

// ---------------------------------------------------------------------------
// Journal: append-only JSONL, fsync'd before any broadcast. This is what
// prevents double payments and lost withdrawals when a run is interrupted.
// ---------------------------------------------------------------------------

export const JOURNAL_DIR = resolve(optionalEnv('JOURNAL_DIR') ?? './journal')

export function journalAppend(file: string, entry: Record<string, unknown>) {
  const path = resolve(JOURNAL_DIR, file)
  mkdirSync(dirname(path), { recursive: true })
  const line = JSON.stringify({ ...entry, at: new Date().toISOString() }, (_k, v) =>
    typeof v === 'bigint' ? v.toString() : v,
  ) + '\n'
  const fd = openSync(path, 'a')
  try {
    writeSync(fd, line)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
}

export function journalRead<T = Record<string, any>>(file: string): T[] {
  const path = resolve(JOURNAL_DIR, file)
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l, i) => {
      try { return JSON.parse(l) as T } catch { die(`${path} line ${i + 1} is corrupt; fix by hand before continuing`) }
    })
}

/**
 * Payouts and sweeps both spend from the ops wallet. Running them at the same
 * time would race on the nonce, so take an exclusive lock for the whole run.
 */
export function acquireLock(owner: string) {
  mkdirSync(JOURNAL_DIR, { recursive: true })
  const path = resolve(JOURNAL_DIR, '.ops-wallet.lock')
  let fd: number
  try {
    fd = openSync(path, 'wx')
  } catch {
    die(`lock ${path} exists: another payout/sweep is running, or a previous run crashed.\n` +
      `Contents: ${readFileSync(path, 'utf8').trim()}\nDelete it only after confirming nothing is running.`)
  }
  writeSync(fd, `${owner} pid=${process.pid} started=${new Date().toISOString()}\n`)
  closeSync(fd)
  const release = () => { try { unlinkSync(path) } catch {} }
  process.on('exit', release)
  process.on('SIGINT', () => { release(); process.exit(130) })
  process.on('SIGTERM', () => { release(); process.exit(143) })
}
