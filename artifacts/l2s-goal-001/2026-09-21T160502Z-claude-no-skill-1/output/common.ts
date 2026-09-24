// Shared config, constants and guards for payout.ts and sweep.ts.
//
// Every address below was checked on-chain on 2026-09-21 (see NOTES.md →
// "Pinned addresses"). The scripts re-verify the important ones at runtime
// and refuse to run if anything doesn't match.

import {
  type Address,
  type Chain,
  type Hash,
  type Hex,
  type TransactionReceipt,
  TransactionReceiptNotFoundError,
  createPublicClient,
  getAddress,
  http,
  isAddress,
  zeroAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo as celoBase, mainnet } from 'viem/chains'

// ---------------------------------------------------------------------------
// Chains
// ---------------------------------------------------------------------------

export const CELO_CHAIN_ID = 42_220
export const MAINNET_CHAIN_ID = 1

// Celo is an OP Stack L2 settling to Ethereum (since the March 2025 migration).
// viem's built-in `celo` chain doesn't carry the L1 bridge contracts, so we add
// them here. Source: ethereum-optimism/superchain-registry
// superchain/configs/mainnet/celo.toml, cross-checked on-chain.
export const CELO_L1_CONTRACTS = {
  portal: '0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC', // OptimismPortalProxy
  disputeGameFactory: '0xFbAC162162f4009Bb007C6DeBC36B1dAC10aF683',
  systemConfig: '0x89E31965D844a309231B1f17759Ccaf1b7c09861',
  l1StandardBridge: '0x9C4955b92F34148dbcfDCD82e9c9eCe5CF2badfe',
} as const satisfies Record<string, Address>

export const celo = {
  ...celoBase,
  sourceId: MAINNET_CHAIN_ID,
  contracts: {
    ...celoBase.contracts,
    portal: { [MAINNET_CHAIN_ID]: { address: CELO_L1_CONTRACTS.portal } },
    disputeGameFactory: {
      [MAINNET_CHAIN_ID]: { address: CELO_L1_CONTRACTS.disputeGameFactory },
    },
    l1StandardBridge: {
      [MAINNET_CHAIN_ID]: { address: CELO_L1_CONTRACTS.l1StandardBridge },
    },
  },
} as const satisfies Chain

export { mainnet }

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

// Native Circle-issued USDC on Celo. 6 decimals, NOT 18.
// Do not confuse with USDC.e / bridged variants or with cUSD (Mento stablecoin).
export const CELO_USDC: Address = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C'
export const USDC_DECIMALS = 6

// CELO as it exists on Ethereum mainnet. This ERC-20 is Celo's gas-paying
// token; the canonical bridge releases withdrawn CELO as THIS token on L1.
export const L1_CELO_TOKEN: Address = '0x057898f3C43F129a17517B9056D23851F124b19f'

// Placeholder the brief shipped with. The sweep refuses to run against it.
export const PLACEHOLDER_TREASURY: Address = '0x1111111111111111111111111111111111111111'

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

export function env(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) die(`Missing required env var ${name} (see NOTES.md).`)
  return v
}

export function optionalEnv(name: string): string | undefined {
  const v = process.env[name]?.trim()
  return v ? v : undefined
}

/** Strict address parse: rejects bad checksums on mixed-case input and the zero address. */
export function parseAddress(value: string, label: string): Address {
  if (!isAddress(value, { strict: true }))
    die(`${label}: "${value}" is not a valid address (or has a bad EIP-55 checksum).`)
  const a = getAddress(value)
  if (a === zeroAddress) die(`${label}: zero address is not allowed.`)
  return a
}

export function loadPrivateKey(name: string): Hex {
  const raw = env(name)
  const key = (raw.startsWith('0x') ? raw : `0x${raw}`) as Hex
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) die(`${name} is not a 32-byte hex private key.`)
  return key
}

/**
 * The ops wallet address is always configured explicitly (OPS_ADDRESS) so that
 * dry runs work without the key present, and so that an --execute run with the
 * wrong key loaded fails loudly instead of paying from the wrong wallet.
 */
export function loadOpsAccount(execute: boolean) {
  const address = parseAddress(env('OPS_ADDRESS'), 'OPS_ADDRESS')
  if (!execute) return { address, account: undefined }
  const account = privateKeyToAccount(loadPrivateKey('OPS_PRIVATE_KEY'))
  if (account.address !== address)
    die(`OPS_PRIVATE_KEY controls ${account.address}, but OPS_ADDRESS is ${address}. Refusing.`)
  return { address, account }
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export function celoRpcUrl(): string {
  const url = optionalEnv('CELO_RPC_URL')
  if (url) return url
  warn('CELO_RPC_URL not set; falling back to public https://forno.celo.org (rate-limited, not for production).')
  return 'https://forno.celo.org'
}

export function l1RpcUrl(): string {
  return env('ETH_RPC_URL')
}

export function celoPublicClient() {
  return createPublicClient({ chain: celo, transport: http(celoRpcUrl()) })
}

/**
 * Receipt lookup that distinguishes "not mined" (undefined) from RPC failures
 * (throws). Never treat a flaky RPC as "the tx doesn't exist" — that's how
 * payments get sent twice.
 */
export async function findReceipt(
  client: { getTransactionReceipt(args: { hash: Hash }): Promise<TransactionReceipt> },
  hash: Hash,
): Promise<TransactionReceipt | undefined> {
  // Load-balanced RPCs (incl. public forno) sometimes answer from a node that
  // lags or lacks the receipt, so "not found" is only believed after retries.
  for (let attempt = 1; ; attempt++) {
    try {
      return await client.getTransactionReceipt({ hash })
    } catch (e) {
      if (!(e instanceof TransactionReceiptNotFoundError)) throw e
      if (attempt >= 5) return undefined
      await new Promise((r) => setTimeout(r, 2_000))
    }
  }
}

export async function assertChainId(client: { getChainId(): Promise<number> }, expected: number, label: string) {
  const id = await client.getChainId()
  if (id !== expected) die(`${label} RPC reports chainId ${id}, expected ${expected}. Wrong RPC URL?`)
}

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

export function die(msg: string): never {
  console.error(`\nERROR: ${msg}`)
  process.exit(1)
}

export function warn(msg: string) {
  console.warn(`WARN: ${msg}`)
}

export function flag(args: string[], name: string): boolean {
  return args.includes(name)
}

export function option(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  if (i === -1) return undefined
  const v = args[i + 1]
  if (v === undefined || v.startsWith('--')) die(`${name} needs a value.`)
  return v
}

export function positionals(args: string[], optionsWithValues: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!
    if (optionsWithValues.includes(a)) i++
    else if (!a.startsWith('--')) out.push(a)
  }
  return out
}

/** Parse a non-negative decimal string into base units with exact precision (no floats). */
export function parseDecimal(value: string, decimals: number, label: string): bigint {
  const s = value.trim()
  const m = /^(\d+)(?:\.(\d+))?$/.exec(s)
  if (!m) die(`${label}: "${value}" is not a plain decimal number (no signs, commas, exponents or currency symbols).`)
  const [, whole, frac = ''] = m
  if (frac.length > decimals) die(`${label}: "${value}" has more than ${decimals} decimal places.`)
  return BigInt(whole!) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, '0') || '0')
}

/**
 * Last human gate before broadcasting. Interactive by default; non-interactive
 * runs must pass the identical phrase via --confirm "<phrase>" (so a scheduler
 * can't broadcast a batch whose count/total nobody looked at).
 */
export async function confirmPrompt(expected: string): Promise<void> {
  const args = process.argv.slice(2)
  if (args.includes('--confirm')) {
    const given = option(args, '--confirm')
    if (given !== expected) die(`--confirm "${given}" does not match "${expected}". Nothing was broadcast.`)
    console.log(`\nConfirmed via --confirm "${expected}".`)
    return
  }
  if (!process.stdin.isTTY) die(`--execute needs an interactive terminal, or --confirm "${expected}".`)
  const { createInterface } = await import('node:readline/promises')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(`\nType "${expected}" to broadcast, anything else aborts: `)
  rl.close()
  if (answer.trim() !== expected) die('Aborted by operator. Nothing was broadcast.')
}
