// Shared plumbing for payout.ts and sweep.ts: chain config, env, signers,
// crash-safe journals and a sign → persist → broadcast send path.
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import {
  type Account,
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  isAddress,
  isAddressEqual,
  keccak256,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, mainnet } from 'viem/chains'

if (existsSync('.env')) process.loadEnvFile('.env')

// ---------------------------------------------------------------------------
// Addresses. Verified against live chain state on 2026-09-21 (see NOTES.md).
// Celo L1 contracts come from the superchain-registry entry for chain 42220.
// ---------------------------------------------------------------------------

/** Circle-native USDC on Celo (6 decimals). */
export const CELO_USDC: Address = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C'
/**
 * Fee-currency adapter for USDC (CIP-64). Gas is paid in USDC by putting the
 * *adapter* — not the token — in the tx's feeCurrency field. Registered in
 * FeeCurrencyDirectory 0x15F344b9E6c3Cb6F0376A36A64928b13F62C6276.
 */
export const CELO_USDC_FEE_ADAPTER: Address = '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B'
/** L2ToL1MessagePasser predeploy — where native-CELO withdrawals start. */
export const L2_TO_L1_MESSAGE_PASSER: Address = '0x4200000000000000000000000000000000000016'
/** Celo OptimismPortal (proxy) on Ethereum mainnet. */
export const CELO_PORTAL_L1: Address = '0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC'
/** Celo DisputeGameFactory (proxy) on Ethereum mainnet. */
export const CELO_DISPUTE_GAME_FACTORY_L1: Address = '0xFbAC162162f4009Bb007C6DeBC36B1dAC10aF683'
/** Celo SystemConfig (proxy) on Ethereum mainnet. */
export const CELO_SYSTEM_CONFIG_L1: Address = '0x89E31965D844a309231B1f17759Ccaf1b7c09861'
/**
 * CELO as an ERC-20 on Ethereum mainnet. This is what a finalized withdrawal
 * delivers to the treasury — not ETH. Read from SystemConfig.gasPayingToken().
 */
export const CELO_TOKEN_L1: Address = '0x057898f3C43F129a17517B9056D23851F124b19f'

/** Placeholder the task shipped with; refuse to send anywhere near it. */
export const PLACEHOLDER_TREASURY: Address = '0x1111111111111111111111111111111111111111'

/**
 * viem's `celo` chain has no L1 contract map, which the OP-stack withdrawal
 * actions need. Same chain, plus the portal and dispute game factory.
 */
export const celoWithL1 = defineChain({
  ...celo,
  sourceId: mainnet.id,
  contracts: {
    ...celo.contracts,
    portal: { [mainnet.id]: { address: CELO_PORTAL_L1 } },
    disputeGameFactory: { [mainnet.id]: { address: CELO_DISPUTE_GAME_FACTORY_L1 } },
  },
})

// ---------------------------------------------------------------------------
// Env / CLI
// ---------------------------------------------------------------------------

export function env(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) die(`Missing required env var ${name} (see .env.example)`)
  return v
}

export function envAddress(name: string): Address {
  const v = env(name)
  if (!isAddress(v, { strict: false })) die(`${name}=${v} is not an address`)
  // A mixed-case address must carry a valid checksum; all-lowercase is accepted.
  if (v !== v.toLowerCase() && !isAddress(v, { strict: true }))
    die(`${name}=${v} has an invalid EIP-55 checksum — likely a typo`)
  return getAddress(v)
}

export function die(msg: string): never {
  console.error(`\nERROR: ${msg}`)
  process.exit(1)
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

export type GasCurrency = 'USDC' | 'CELO'

export function gasCurrency(): GasCurrency {
  const v = (process.env.GAS_CURRENCY ?? 'USDC').trim().toUpperCase()
  if (v !== 'USDC' && v !== 'CELO') die(`GAS_CURRENCY must be USDC or CELO, got ${v}`)
  return v
}

/** feeCurrency field for Celo txs; undefined = pay gas in CELO. */
export function feeCurrencyFor(g: GasCurrency): Address | undefined {
  return g === 'USDC' ? CELO_USDC_FEE_ADAPTER : undefined
}

// ---------------------------------------------------------------------------
// Clients and signers
// ---------------------------------------------------------------------------

export function celoClient(): PublicClient<ReturnType<typeof http>, typeof celoWithL1> {
  return createPublicClient({ chain: celoWithL1, transport: http(env('CELO_RPC_URL'), { retryCount: 3 }) })
}

export function l1Client(): PublicClient<ReturnType<typeof http>, typeof mainnet> {
  return createPublicClient({ chain: mainnet, transport: http(env('ETH_RPC_URL'), { retryCount: 3 }) })
}

/**
 * Loads a signer from `${prefix}_PRIVATE_KEY` and insists it derives the
 * address in `${prefix}_ADDRESS`, so a wrong key fails before it signs.
 * For production custody, swap this for a KMS/HSM-backed viem Account —
 * everything downstream only needs `signTransaction`.
 */
export function loadSigner(prefix: 'OPS' | 'RELAYER'): Account {
  const expected = envAddress(`${prefix}_ADDRESS`)
  const pk = env(`${prefix}_PRIVATE_KEY`)
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) die(`${prefix}_PRIVATE_KEY is not a 32-byte hex key`)
  const account = privateKeyToAccount(pk as Hex)
  if (!isAddressEqual(account.address, expected))
    die(`${prefix}_PRIVATE_KEY derives ${account.address}, but ${prefix}_ADDRESS is ${expected}`)
  return account
}

// ---------------------------------------------------------------------------
// Journals: JSON state written atomically, so a crash never leaves a torn file.
// ---------------------------------------------------------------------------

export const STATE_DIR = process.env.STATE_DIR?.trim() || 'state'

const bigintReplacer = (_k: string, v: unknown) => (typeof v === 'bigint' ? `${v}n` : v)
const bigintReviver = (_k: string, v: unknown) =>
  typeof v === 'string' && /^-?\d+n$/.test(v) ? BigInt(v.slice(0, -1)) : v

export function readJson<T>(file: string, fallback: T): T {
  const path = join(STATE_DIR, file)
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf8'), bigintReviver) as T
}

export function writeJson(file: string, data: unknown): void {
  const path = join(STATE_DIR, file)
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  const fd = openSync(tmp, 'w')
  writeSync(fd, JSON.stringify(data, bigintReplacer, 2))
  fsyncSync(fd)
  closeSync(fd)
  renameSync(tmp, path)
}

export function writeText(file: string, text: string): string {
  const path = join(STATE_DIR, file)
  mkdirSync(dirname(path), { recursive: true })
  const fd = openSync(path, 'w')
  writeSync(fd, text)
  fsyncSync(fd)
  closeSync(fd)
  return path
}

/** One run at a time per tool. A stale lock after a crash is removed by hand. */
export function acquireLock(name: string): void {
  mkdirSync(STATE_DIR, { recursive: true })
  const path = join(STATE_DIR, `${name}.lock`)
  try {
    closeSync(openSync(path, 'wx'))
  } catch {
    die(
      `${path} exists — another ${name} run is active, or a previous one crashed.\n` +
        `Confirm nothing is running, then delete the lock and re-run (the journal makes re-runs safe).`,
    )
  }
  const release = () => existsSync(path) && unlinkSync(path)
  process.on('exit', release)
  for (const sig of ['SIGINT', 'SIGTERM'] as const)
    process.on(sig, () => {
      console.error(`\n${sig} received — stopping. Re-run to resume from the journal.`)
      process.exit(130)
    })
}

// ---------------------------------------------------------------------------
// Sending. Every tx is signed locally, its hash and raw bytes are journaled,
// and only then is it broadcast. A crash at any point leaves a record we can
// reconcile: same raw tx ⇒ same nonce ⇒ it can land at most once.
// ---------------------------------------------------------------------------

/** Any viem public client; Celo's chain formatters don't fit the generic `Chain` type. */
type AnyClient = PublicClient<any, any>

export type SignedTx = { hash: Hash; raw: Hex; nonce: number; from: Address }

export async function signTx(
  client: AnyClient,
  account: Account,
  tx: { to: Address; data?: Hex; value?: bigint; feeCurrency?: Address; gas?: bigint },
  nonce: number,
): Promise<SignedTx> {
  const wallet = createWalletClient({ account, chain: client.chain, transport: http(client.transport.url as string) })
  // Estimating also simulates: a tx that would revert is never signed.
  const estimated = tx.gas ?? await client.estimateGas({
    account: account.address,
    to: tx.to,
    data: tx.data,
    value: tx.value,
    ...(tx.feeCurrency ? { feeCurrency: tx.feeCurrency } : {}),
  } as any)
  const request = await wallet.prepareTransactionRequest({
    account,
    chain: client.chain,
    to: tx.to,
    data: tx.data,
    value: tx.value ?? 0n,
    nonce,
    gas: tx.gas ?? (estimated * 120n) / 100n,
    ...(tx.feeCurrency ? { feeCurrency: tx.feeCurrency } : {}),
  } as any)
  const raw = await wallet.signTransaction(request as any)
  return { hash: keccak256(raw), raw, nonce, from: account.address }
}

export async function broadcast(client: AnyClient, signed: SignedTx): Promise<void> {
  try {
    await client.sendRawTransaction({ serializedTransaction: signed.raw })
  } catch (e) {
    const msg = String((e as Error).message).toLowerCase()
    // Already in the mempool or already mined: fine, the receipt check decides.
    if (msg.includes('already known') || msg.includes('nonce too low') || msg.includes('already imported')) return
    throw e
  }
}

export type Reconciled =
  | { state: 'mined'; receipt: TransactionReceipt }
  | { state: 'pending' }
  | { state: 'nonce-consumed-elsewhere' }

/**
 * Settle a journaled-but-unconfirmed tx. Never signs anything new:
 *  - receipt exists → mined (success or revert);
 *  - nonce still open → rebroadcast the same raw bytes and wait;
 *  - nonce used but no receipt for our hash → something else took the nonce
 *    (or the RPC pruned the receipt). A human checks the explorer.
 */
export async function reconcile(
  client: AnyClient,
  signed: SignedTx,
  timeoutMs: number,
): Promise<Reconciled> {
  const existing = await client.getTransactionReceipt({ hash: signed.hash }).catch(() => null)
  if (existing) return { state: 'mined', receipt: existing }
  const latest = await client.getTransactionCount({ address: signed.from, blockTag: 'latest' })
  if (latest > signed.nonce) return { state: 'nonce-consumed-elsewhere' }
  await broadcast(client, signed)
  return waitMined(client, signed.hash, timeoutMs)
}

export async function waitMined(client: AnyClient, hash: Hash, timeoutMs: number): Promise<Reconciled> {
  try {
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: timeoutMs, pollingInterval: 2_000 })
    return { state: 'mined', receipt }
  } catch (e) {
    if ((e as Error).name === 'WaitForTransactionReceiptTimeoutError') return { state: 'pending' }
    throw e
  }
}

/** Refuse to start if the account has txs in flight we don't know about. */
export async function assertNoPendingTxs(client: AnyClient, address: Address): Promise<number> {
  const [latest, pending] = await Promise.all([
    client.getTransactionCount({ address, blockTag: 'latest' }),
    client.getTransactionCount({ address, blockTag: 'pending' }),
  ])
  if (pending !== latest)
    die(
      `${address} has ${pending - latest} pending tx(s) on chain ${client.chain.id} not created by this run.\n` +
        `This tool must be the only thing sending from this wallet while it runs. Wait for them to clear.`,
    )
  return latest
}

export const fmtTime = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString().replace('.000Z', 'Z')

export function fmtDuration(seconds: number): string {
  if (seconds <= 0) return 'now'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ')
}
