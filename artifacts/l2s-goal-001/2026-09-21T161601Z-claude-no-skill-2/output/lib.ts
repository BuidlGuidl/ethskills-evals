// Shared plumbing for payout.ts and sweep.ts: config, clients, ledger files, and
// crash-safe transaction sending on Celo.
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
import { createInterface } from 'node:readline/promises'
import {
  type Address,
  type Hash,
  type Hex,
  type TransactionReceipt,
  BaseError,
  createPublicClient,
  createWalletClient,
  defineChain,
  formatUnits,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseGwei,
  parseUnits,
  zeroAddress,
} from 'viem'
import { type PrivateKeyAccount, privateKeyToAccount } from 'viem/accounts'
import { celo, mainnet } from 'viem/chains'

if (existsSync('.env')) process.loadEnvFile('.env')

// ---------------------------------------------------------------------------
// Addresses. Verified 2026-09-21 against ethereum-optimism/superchain-registry
// (superchain/configs/mainnet/celo.toml) and by on-chain reads:
//   - USDC on Celo: symbol "USDC", 6 decimals (Circle-native, not bridged).
//   - OptimismPortal.systemConfig() == SystemConfig below,
//     SystemConfig.gasPayingToken() == (CELO_ON_ETHEREUM, 18).
// Both scripts re-check the critical ones at runtime.
// ---------------------------------------------------------------------------
export const CELO_USDC: Address = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C'
export const L2_TO_L1_MESSAGE_PASSER: Address = '0x4200000000000000000000000000000000000016'
export const OPTIMISM_PORTAL: Address = '0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC'
export const DISPUTE_GAME_FACTORY: Address = '0xFbAC162162f4009Bb007C6DeBC36B1dAC10aF683'
export const SYSTEM_CONFIG: Address = '0x89E31965D844a309231B1f17759Ccaf1b7c09861'
/** CELO as an ERC-20 on Ethereum mainnet. This is what the treasury receives. */
export const CELO_ON_ETHEREUM: Address = '0x057898f3C43F129a17517B9056D23851F124b19f'

export const USDC_DECIMALS = 6
export const CELO_DECIMALS = 18

/** Celo mainnet with the OP Stack bridge contracts viem needs for withdrawals. */
export const celoL2 = defineChain({
  ...celo,
  sourceId: mainnet.id,
  contracts: {
    ...celo.contracts,
    l2ToL1MessagePasser: { address: L2_TO_L1_MESSAGE_PASSER },
    portal: { [mainnet.id]: { address: OPTIMISM_PORTAL } },
    disputeGameFactory: { [mainnet.id]: { address: DISPUTE_GAME_FACTORY } },
  },
})

export const LEDGER_DIR = process.env.LEDGER_DIR?.trim() || './ledger'

// ---------------------------------------------------------------------------
// Errors / env
// ---------------------------------------------------------------------------

/** An expected, operator-facing failure. Printed without a stack trace. */
export class OpsError extends Error {}

export function env(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new OpsError(`Missing required env var ${name} (see .env.example).`)
  return value
}

export function envOpt(name: string): string | undefined {
  return process.env[name]?.trim() || undefined
}

export async function runMain(main: () => Promise<void>) {
  try {
    await main()
  } catch (err) {
    if (err instanceof OpsError) console.error(`\nERROR: ${err.message}`)
    else console.error('\nUNEXPECTED ERROR:', err)
    process.exitCode = 1
  }
}

// ---------------------------------------------------------------------------
// Parsing / formatting
// ---------------------------------------------------------------------------

/** Accepts all-lowercase or correctly EIP-55 checksummed addresses; rejects zero. */
export function parseAddress(value: string, what: string): Address {
  if (!isAddress(value, { strict: true }))
    throw new OpsError(`${what}: "${value}" is not a valid address (bad format or EIP-55 checksum).`)
  const address = getAddress(value)
  if (address === zeroAddress) throw new OpsError(`${what}: zero address.`)
  return address
}

/** Exact decimal -> base units. Never rounds: too many decimals is an error. */
export function parseAmount(value: string, decimals: number, what: string): bigint {
  const re = new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`)
  if (!re.test(value))
    throw new OpsError(`${what}: "${value}" is not a plain decimal with at most ${decimals} decimal places.`)
  return parseUnits(value, decimals)
}

export const fmtUsdc = (v: bigint) => `${formatUnits(v, USDC_DECIMALS)} USDC`
export const fmtCelo = (v: bigint) => `${formatUnits(v, CELO_DECIMALS)} CELO`

// ---------------------------------------------------------------------------
// Keys and clients
// ---------------------------------------------------------------------------

/**
 * Loads a hot key from env and checks it against the address the operator says
 * it should control. Swap this for a KMS/HSM-backed viem account in production
 * if your key policy requires it; nothing else depends on the key being local.
 */
export function loadAccount(keyVar: string, expectedAddressVar: string): PrivateKeyAccount {
  const key = env(keyVar)
  if (!/^0x[0-9a-fA-F]{64}$/.test(key))
    throw new OpsError(`${keyVar} must be a 0x-prefixed 32-byte hex private key.`)
  const account = privateKeyToAccount(key as Hex)
  const expected = parseAddress(env(expectedAddressVar), expectedAddressVar)
  if (account.address !== expected)
    throw new OpsError(`${keyVar} controls ${account.address} but ${expectedAddressVar} is ${expected}.`)
  return account
}

const transport = (url: string) => http(url, { retryCount: 4, retryDelay: 750, timeout: 30_000 })

export async function celoClient(url = env('CELO_RPC_URL')) {
  const client = createPublicClient({ chain: celoL2, transport: transport(url) })
  const chainId = await client.getChainId()
  if (chainId !== celoL2.id) throw new OpsError(`CELO_RPC_URL is chain ${chainId}, expected Celo mainnet (42220).`)
  return client
}
export type CeloClient = Awaited<ReturnType<typeof celoClient>>

export function celoWallet(account: PrivateKeyAccount) {
  return createWalletClient({ account, chain: celoL2, transport: transport(env('CELO_RPC_URL')) })
}
export type CeloWallet = ReturnType<typeof celoWallet>

export async function ethClient() {
  const client = createPublicClient({ chain: mainnet, transport: transport(env('ETH_RPC_URL')) })
  const chainId = await client.getChainId()
  if (chainId !== mainnet.id) throw new OpsError(`ETH_RPC_URL is chain ${chainId}, expected Ethereum mainnet (1).`)
  return client
}

export function ethWallet(account: PrivateKeyAccount) {
  return createWalletClient({ account, chain: mainnet, transport: transport(env('ETH_RPC_URL')) })
}

// ---------------------------------------------------------------------------
// Ledger files, lock, confirmation
// ---------------------------------------------------------------------------

export function readJson<T>(path: string): T | undefined {
  if (!existsSync(path)) return undefined
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

/** write-to-temp + fsync + rename, so a crash never leaves a half-written ledger file. */
export function writeJsonAtomic(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${process.pid}`
  const fd = openSync(tmp, 'w')
  writeSync(fd, JSON.stringify(data, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2) + '\n')
  fsyncSync(fd)
  closeSync(fd)
  renameSync(tmp, path)
}

/**
 * Payouts and sweeps share the ops wallet's nonce sequence, so only one
 * broadcasting run may be active at a time. This only protects runs that share
 * the same LEDGER_DIR — run everything from one machine/volume.
 */
export function acquireLock(label: string): () => void {
  mkdirSync(LEDGER_DIR, { recursive: true })
  const path = join(LEDGER_DIR, '.ops-wallet.lock')
  let fd: number
  try {
    fd = openSync(path, 'wx')
  } catch (err: any) {
    if (err?.code !== 'EEXIST') throw err
    throw new OpsError(
      `Lock ${path} is held (${readFileSync(path, 'utf8').trim()}). Another payout/sweep may be ` +
        `broadcasting from the ops wallet. Delete the file only if you are certain nothing else is running.`,
    )
  }
  writeSync(fd, `${label} pid=${process.pid} started=${new Date().toISOString()}\n`)
  closeSync(fd)
  let released = false
  const release = () => {
    if (released) return
    released = true
    try {
      unlinkSync(path)
    } catch {}
  }
  process.once('exit', release)
  return release
}

/**
 * Broadcasting requires the operator to type a short code derived from exactly
 * what will be sent. `--confirm <code>` allows unattended runs.
 */
export async function requireConfirmation(code: string, confirmArg: string | undefined) {
  if (confirmArg !== undefined) {
    if (confirmArg !== code) throw new OpsError(`--confirm ${confirmArg} does not match this run's code ${code}.`)
    return
  }
  if (!process.stdin.isTTY) throw new OpsError(`Not a TTY. Re-run with --confirm ${code} after reviewing the plan.`)
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = (await rl.question(`\nType ${code} to broadcast (anything else aborts): `)).trim()
  rl.close()
  if (answer !== code) throw new OpsError('Aborted by operator. Nothing was sent.')
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// Crash-safe sending on Celo
//
// Invariant: a logical payment is bound to ONE nonce from the moment it is
// signed. Every (re)broadcast or fee-bump for it reuses that nonce, so at most
// one of its transactions can ever be included. The signed tx is persisted
// BEFORE broadcast, so a crash at any point is recoverable by re-running.
// ---------------------------------------------------------------------------

export type SignedTx = {
  nonce: number
  hashes: Hash[] // every tx signed for this nonce (original + fee bumps)
  raws: Hex[]
  gas: string
  maxFeePerGas: string
  maxPriorityFeePerGas: string
  signedAt: string
}

export type Call = { to: Address; data: Hex; value?: bigint }

type Outcome =
  | { kind: 'mined'; receipt: TransactionReceipt }
  | { kind: 'pending' }
  | { kind: 'nonce-used-elsewhere' }

export class CeloSender {
  readonly confirmations = BigInt(envOpt('CELO_CONFIRMATIONS') ?? '5')
  readonly maxFeePerGasCap = parseGwei(envOpt('CELO_MAX_FEE_GWEI') ?? '1000')
  readonly timeoutMs = Number(envOpt('CELO_TX_TIMEOUT_SEC') ?? '120') * 1000

  constructor(
    readonly client: CeloClient,
    readonly wallet: CeloWallet,
    readonly account: PrivateKeyAccount,
  ) {}

  /** Refuses to start new work while the account has unconfirmed transactions. */
  async assertNoPendingTransactions(): Promise<number> {
    const address = this.account.address
    const [latest, pending] = await Promise.all([
      this.client.getTransactionCount({ address, blockTag: 'latest' }),
      this.client.getTransactionCount({ address, blockTag: 'pending' }),
    ])
    if (pending !== latest)
      throw new OpsError(
        `${address} has ${pending - latest} unconfirmed tx(s) (nonce latest=${latest} pending=${pending}). ` +
          `Wait for them or investigate before sending anything new.`,
      )
    return latest
  }

  private async sign(call: Call, nonce: number, bumpFrom?: SignedTx) {
    const fees = await this.client.estimateFeesPerGas()
    let maxFeePerGas = fees.maxFeePerGas
    let maxPriorityFeePerGas = fees.maxPriorityFeePerGas
    if (bumpFrom) {
      // Replacement must beat the previous tx by >=10% on both fields; use 30%.
      const bump = (v: string) => (BigInt(v) * 13n) / 10n
      if (maxFeePerGas < bump(bumpFrom.maxFeePerGas)) maxFeePerGas = bump(bumpFrom.maxFeePerGas)
      if (maxPriorityFeePerGas < bump(bumpFrom.maxPriorityFeePerGas))
        maxPriorityFeePerGas = bump(bumpFrom.maxPriorityFeePerGas)
    }
    if (maxFeePerGas > this.maxFeePerGasCap)
      throw new OpsError(
        `Celo maxFeePerGas ${formatUnits(maxFeePerGas, 9)} gwei exceeds CELO_MAX_FEE_GWEI. Not signing.`,
      )
    // estimateGas doubles as a final simulation: a reverting call throws here, before anything is signed.
    // Estimate against `latest`: against `pending`, a fee-bump would be estimated on top of the very tx
    // it replaces (e.g. recipient balance already non-zero -> cheaper) and could run out of gas.
    const estimate = await this.client.estimateGas({ account: this.account, ...call, blockTag: 'latest' })
    let gas = (estimate * 13n) / 10n
    if (bumpFrom && gas < BigInt(bumpFrom.gas)) gas = BigInt(bumpFrom.gas)
    const request = await this.wallet.prepareTransactionRequest({
      ...call,
      type: 'eip1559',
      nonce,
      gas,
      maxFeePerGas,
      maxPriorityFeePerGas,
    })
    const raw = await this.wallet.signTransaction(request)
    return { raw, hash: keccak256(raw), gas, maxFeePerGas, maxPriorityFeePerGas }
  }

  private async broadcast(raw: Hex) {
    try {
      await this.client.sendRawTransaction({ serializedTransaction: raw })
    } catch (err) {
      const msg = err instanceof BaseError ? err.details || err.shortMessage : String(err)
      // Already in the pool or already mined: the outcome check below sorts it out.
      if (/already known|known transaction|nonce too low|already imported/i.test(msg)) return
      if (/underpriced|fee too low/i.test(msg))
        throw new OpsError(`Broadcast rejected (${msg}). Re-run with --replace-stuck to fee-bump on the same nonce.`)
      throw new OpsError(
        `Broadcast failed: ${msg}\nThe signed tx is recorded and its nonce is reserved; re-running rebroadcasts ` +
          `it, so fixing the cause (e.g. CELO for gas) and re-running is safe.`,
      )
    }
  }

  private async findReceipt(hashes: Hash[]): Promise<TransactionReceipt | undefined> {
    for (const hash of hashes) {
      const receipt = await this.client.getTransactionReceipt({ hash }).catch(() => undefined)
      if (receipt) return receipt
    }
  }

  private async checkOutcome(signed: SignedTx): Promise<Outcome> {
    const receipt = await this.findReceipt(signed.hashes)
    if (receipt) return { kind: 'mined', receipt }
    const latest = await this.client.getTransactionCount({ address: this.account.address, blockTag: 'latest' })
    if (latest <= signed.nonce) return { kind: 'pending' }
    // Nonce is used but we saw no receipt. Public RPCs sometimes miss receipts
    // briefly, so look again before concluding anything.
    for (let i = 0; i < 5; i++) {
      await sleep(3_000)
      const again = await this.findReceipt(signed.hashes)
      if (again) return { kind: 'mined', receipt: again }
    }
    return { kind: 'nonce-used-elsewhere' }
  }

  private async waitForOutcome(signed: SignedTx, timeoutMs: number): Promise<Outcome> {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const outcome = await this.checkOutcome(signed)
      if (outcome.kind !== 'pending' || Date.now() > deadline) return outcome
      await sleep(2_000)
    }
  }

  /** Waits for N confirmations, then re-reads the receipt to make sure it survived. */
  private async confirm(receipt: TransactionReceipt): Promise<TransactionReceipt> {
    const target = receipt.blockNumber + this.confirmations - 1n
    while ((await this.client.getBlockNumber()) < target) await sleep(1_000)
    const final = await this.client.getTransactionReceipt({ hash: receipt.transactionHash }).catch(() => undefined)
    if (!final || final.blockHash !== receipt.blockHash)
      throw new OpsError(`Tx ${receipt.transactionHash} was reorged out. Re-run to resume.`)
    return final
  }

  /**
   * Sends `call` exactly once across any number of crashes/re-runs.
   * `existing` is what was previously persisted for this logical payment, if anything.
   * `persist` must durably store the SignedTx before this returns control to the network.
   */
  async sendOnce(opts: {
    call: Call
    existing?: SignedTx
    persist: (signed: SignedTx) => void
    replaceStuck?: boolean
  }): Promise<TransactionReceipt> {
    const { call, persist } = opts
    let signed = opts.existing

    if (!signed) {
      const nonce = await this.assertNoPendingTransactions()
      const tx = await this.sign(call, nonce)
      signed = {
        nonce,
        hashes: [tx.hash],
        raws: [tx.raw],
        gas: tx.gas.toString(),
        maxFeePerGas: tx.maxFeePerGas.toString(),
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas.toString(),
        signedAt: new Date().toISOString(),
      }
      persist(signed)
      await this.broadcast(tx.raw)
    } else {
      const outcome = await this.checkOutcome(signed)
      if (outcome.kind === 'mined') return this.confirm(outcome.receipt)
      if (outcome.kind === 'nonce-used-elsewhere') throw this.nonceUsedElsewhere(signed)
      if (opts.replaceStuck) {
        const tx = await this.sign(call, signed.nonce, signed)
        signed = {
          ...signed,
          hashes: [...signed.hashes, tx.hash],
          raws: [...signed.raws, tx.raw],
          gas: tx.gas.toString(),
          maxFeePerGas: tx.maxFeePerGas.toString(),
          maxPriorityFeePerGas: tx.maxPriorityFeePerGas.toString(),
        }
        persist(signed)
        console.log(`  fee-bumped on nonce ${signed.nonce}: ${tx.hash}`)
        await this.broadcast(tx.raw)
      } else {
        console.log(`  resuming nonce ${signed.nonce}: rebroadcasting ${signed.hashes.at(-1)}`)
        await this.broadcast(signed.raws.at(-1)!)
      }
    }

    const outcome = await this.waitForOutcome(signed, this.timeoutMs)
    if (outcome.kind === 'mined') return this.confirm(outcome.receipt)
    if (outcome.kind === 'nonce-used-elsewhere') throw this.nonceUsedElsewhere(signed)
    throw new OpsError(
      `Tx ${signed.hashes.at(-1)} (nonce ${signed.nonce}) not mined yet. Re-run to keep waiting/rebroadcast, ` +
        `or re-run with --replace-stuck to fee-bump on the same nonce.`,
    )
  }

  private nonceUsedElsewhere(signed: SignedTx) {
    return new OpsError(
      `Nonce ${signed.nonce} was consumed but none of our txs for it (${signed.hashes.join(', ')}) has a receipt. ` +
        `Something else sent from the ops wallet, or the RPC is lagging. STOP: check each hash and the ` +
        `wallet's history on https://celoscan.io before doing anything; see NOTES.md "Manual reconciliation".`,
    )
  }
}
