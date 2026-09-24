// Shared plumbing for payout.ts and sweep.ts: chain config, env handling,
// a crash-safe JSON journal, and a "sign → journal → broadcast" sender that
// never double-spends on a rerun.

import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
} from 'node:fs'
import {
  type Address,
  type Hex,
  getAddress,
  isAddress,
  type Client,
  keccak256,
  TransactionReceiptNotFoundError,
  WaitForTransactionReceiptTimeoutError,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
  getChainId,
  getTransactionCount,
  getTransactionReceipt,
  sendRawTransaction,
  signTransaction,
  waitForTransactionReceipt,
} from 'viem/actions'
import { celo } from 'viem/chains'

// ---------------------------------------------------------------------------
// Addresses. All verified on-chain on 2026-09-21 — see NOTES.md "Verified
// constants". sweep.ts re-checks the L1 ones against SystemConfig at runtime.
// ---------------------------------------------------------------------------

/** Native (Circle-issued) USDC on Celo. 6 decimals. NOT USDC.e / bridged USDC. */
export const CELO_USDC: Address = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C'
export const USDC_DECIMALS = 6

/** OP Stack predeploy on Celo L2 used to withdraw native CELO to L1. */
export const L2_TO_L1_MESSAGE_PASSER: Address = '0x4200000000000000000000000000000000000016'

/** Celo's contracts on Ethereum mainnet. */
export const L1 = {
  optimismPortal: '0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC',
  disputeGameFactory: '0xFbAC162162f4009Bb007C6DeBC36B1dAC10aF683',
  systemConfig: '0x89E31965D844a309231B1f17759Ccaf1b7c09861',
  l1StandardBridge: '0x9C4955b92F34148dbcfDCD82e9c9eCe5CF2badfe',
  /** CELO as an ERC-20 on Ethereum. This is what the treasury receives. */
  celoToken: '0x057898f3C43F129a17517B9056D23851F124b19f',
} as const satisfies Record<string, Address>

/**
 * viem's `celo` chain doesn't include the L1 bridge contracts. The op-stack
 * actions (getGame, proveWithdrawal, finalizeWithdrawal, ...) need them.
 */
export const celoWithL1 = {
  ...celo,
  sourceId: 1,
  contracts: {
    ...celo.contracts,
    portal: { 1: { address: L1.optimismPortal } },
    disputeGameFactory: { 1: { address: L1.disputeGameFactory } },
    l1StandardBridge: { 1: { address: L1.l1StandardBridge } },
  },
} as const

// ---------------------------------------------------------------------------
// Env / CLI helpers
// ---------------------------------------------------------------------------

export function env(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) die(`Missing required env var ${name}. See NOTES.md.`)
  return v
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined
}

export function privateKeyAccount(envName: string) {
  const key = env(envName)
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) die(`${envName} must be a 0x-prefixed 32-byte hex private key`)
  return privateKeyToAccount(key as Hex)
}

/** Strict address parse. Mixed-case input must carry a valid EIP-55 checksum. */
export function parseAddress(raw: string, label: string): Address {
  const s = raw.trim()
  if (!isAddress(s, { strict: true })) die(`${label}: "${raw}" is not a valid address (bad format or checksum)`)
  return getAddress(s)
}

export function flag(name: string): boolean {
  return process.argv.includes(name)
}

export function option(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  if (i === -1) return undefined
  const v = process.argv[i + 1]
  if (!v || v.startsWith('--')) die(`${name} needs a value`)
  return v
}

export class Fatal extends Error {}

export function die(msg: string): never {
  throw new Fatal(msg)
}

export async function main(fn: () => Promise<void>) {
  try {
    await fn()
  } catch (e) {
    if (e instanceof Fatal) {
      console.error(`\nERROR: ${e.message}`)
    } else {
      console.error('\nUNEXPECTED ERROR:', e)
    }
    process.exitCode = 1
  } finally {
    releaseLocks()
  }
}

export async function assertChainId(client: Client, expected: number, label: string) {
  const id = await getChainId(client)
  if (id !== expected) die(`${label} RPC is chain ${id}, expected ${expected}. Wrong RPC URL?`)
}

// ---------------------------------------------------------------------------
// Journal: a JSON file that's written atomically (tmp + fsync + rename) and
// guarded by an exclusive lock file so two operators can't run at once.
// ---------------------------------------------------------------------------

const heldLocks = new Set<string>()

function releaseLocks() {
  for (const l of heldLocks) {
    try {
      unlinkSync(l)
    } catch {}
  }
  heldLocks.clear()
}
process.on('SIGINT', () => {
  releaseLocks()
  process.exit(130)
})

export class Journal<T> {
  data: T
  constructor(
    readonly path: string,
    empty: T,
  ) {
    const lock = `${path}.lock`
    try {
      closeSync(openSync(lock, 'wx'))
    } catch {
      die(
        `Lock file ${lock} exists: another run is in progress, or a previous run crashed. ` +
          `Confirm nothing else is running, then delete the lock file and rerun.`,
      )
    }
    heldLocks.add(lock)
    this.data = existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : empty
  }

  save() {
    const tmp = `${this.path}.tmp`
    const fd = openSync(tmp, 'w')
    writeSync(fd, JSON.stringify(this.data, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2))
    fsyncSync(fd)
    closeSync(fd)
    renameSync(tmp, this.path)
  }
}

// ---------------------------------------------------------------------------
// Crash-safe sending.
//
// The dangerous window in any payout script is "tx broadcast, but we crashed
// before recording it" — a naive rerun pays twice. We close that window by
// signing locally first, persisting the raw signed tx + hash + nonce, and only
// then broadcasting. On rerun, `resolveSent` looks the recorded tx up and
// either confirms it, re-broadcasts the *same* signed bytes (cannot double
// pay: same nonce), or halts for a human if the nonce was consumed elsewhere.
// ---------------------------------------------------------------------------

export type SentTx = {
  status: 'signed' | 'confirmed' | 'reverted' | 'nonce-conflict'
  nonce: number
  hash: Hex
  raw: Hex
  blockNumber?: string
}

export async function signAndRecord(
  wallet: Client,
  request: any, // output of prepareTransactionRequest on the same chain
  record: (tx: SentTx) => void,
): Promise<SentTx> {
  const raw = await signTransaction(wallet, request)
  const tx: SentTx = { status: 'signed', nonce: Number(request.nonce), hash: keccak256(raw), raw }
  record(tx) // must be persisted BEFORE broadcast
  return tx
}

export async function broadcastAndWait(client: Client, tx: SentTx, timeoutMs = 180_000): Promise<SentTx> {
  try {
    await sendRawTransaction(client, { serializedTransaction: tx.raw })
  } catch (e) {
    // Re-broadcast of a tx the node already has is fine; anything else we
    // still fall through to the receipt check, which is the source of truth.
    const msg = String((e as Error).message ?? e).toLowerCase()
    if (msg.includes('nonce too low')) {
      // Either ours already mined, or something else took the nonce.
      try {
        const r = await getTransactionReceipt(client, { hash: tx.hash })
        return { ...tx, status: r.status === 'success' ? 'confirmed' : 'reverted', blockNumber: r.blockNumber.toString() }
      } catch {
        return { ...tx, status: 'nonce-conflict' }
      }
    }
    if (!msg.includes('already known')) {
      console.warn(`  broadcast warning: ${(e as Error).message?.split('\n')[0]}`)
    }
  }
  try {
    const r = await waitForTransactionReceipt(client, { hash: tx.hash, timeout: timeoutMs })
    return { ...tx, status: r.status === 'success' ? 'confirmed' : 'reverted', blockNumber: r.blockNumber.toString() }
  } catch (e) {
    if (e instanceof WaitForTransactionReceiptTimeoutError) {
      die(
        `Tx ${tx.hash} (nonce ${tx.nonce}) not mined after ${timeoutMs / 1000}s. It is recorded in the journal; ` +
          `rerun the same command to keep waiting / re-broadcast it. Do NOT send a replacement by hand ` +
          `without reading NOTES.md "Stuck transactions".`,
      )
    }
    throw e
  }
}

/** Reconcile a tx that was signed (and maybe broadcast) by a previous run. */
export async function resolveSent(client: Client, from: Address, tx: SentTx): Promise<SentTx> {
  try {
    const r = await getTransactionReceipt(client, { hash: tx.hash })
    return { ...tx, status: r.status === 'success' ? 'confirmed' : 'reverted', blockNumber: r.blockNumber.toString() }
  } catch (e) {
    if (!(e instanceof TransactionReceiptNotFoundError)) throw e
  }
  const mined = await getTransactionCount(client, { address: from, blockTag: 'latest' })
  if (mined > tx.nonce) {
    // Our nonce was used by some other transaction, so ours can never land.
    return { ...tx, status: 'nonce-conflict' }
  }
  console.log(`  re-broadcasting previously signed tx ${tx.hash} (nonce ${tx.nonce})`)
  return broadcastAndWait(client, tx)
}

/** Refuse to start if the account has in-flight txs we don't know about. */
export async function assertNoPendingTxs(client: Client, from: Address) {
  const [latest, pending] = await Promise.all([
    getTransactionCount(client, { address: from, blockTag: 'latest' }),
    getTransactionCount(client, { address: from, blockTag: 'pending' }),
  ])
  if (pending !== latest) {
    die(
      `${from} has ${pending - latest} pending transaction(s) not tracked by this journal. ` +
        `Something else is using this key. Wait for them to mine or investigate before running.`,
    )
  }
  return latest
}
