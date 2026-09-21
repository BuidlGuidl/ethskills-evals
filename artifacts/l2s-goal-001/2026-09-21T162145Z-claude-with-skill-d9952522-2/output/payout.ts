/**
 * payout.ts — pay a CSV of recipients in USDC on Celo (chain 42220) from the ops wallet.
 *
 * Dry run (default, broadcasts nothing):
 *   npx tsx payout.ts --csv payouts/2026-09.csv
 * Execute:
 *   npx tsx payout.ts --csv payouts/2026-09.csv --expect-count 412 --expect-total 18250.75 --execute
 *
 * Env: CELO_RPC_URL, OPS_PRIVATE_KEY (see NOTES.md).
 *
 * CSV header must be exactly: payout_id,address,amount_usdc
 *   payout_id    globally unique and never reused (it is the idempotency key)
 *   address      recipient on Celo; mixed-case must be a valid EIP-55 checksum
 *   amount_usdc  decimal string, at most 6 decimals, e.g. 125.5
 *
 * Idempotency: every transfer is signed, written to the journal (fsync'd), and only then
 * broadcast. A re-run after a crash resolves in-flight entries by hash before sending
 * anything new, so a payout_id is paid at most once regardless of where the process died.
 */
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, unlinkSync, writeSync } from 'node:fs'
import { dirname } from 'node:path'
import { parseArgs } from 'node:util'
import {
  type Address,
  type Hash,
  type Hex,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  formatEther,
  formatUnits,
  getAddress,
  http,
  isAddress,
  isAddressEqual,
  keccak256,
  parseAbi,
  parseUnits,
  zeroAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo } from 'viem/chains'

// ---------------------------------------------------------------------------
// Pinned mainnet constants. Each is re-verified on-chain at startup before anything is signed.
// ---------------------------------------------------------------------------
const CELO_CHAIN_ID = 42220
// Native Circle USDC on Celo (6 decimals).
const USDC: Address = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C'
// CIP-64 fee-currency adapter for USDC. Gas quoted in 18-decimal units, debited in USDC.
const USDC_FEE_ADAPTER: Address = '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B'
// Celo FeeCurrencyDirectory: the allowlist of fee currencies the protocol accepts.
const FEE_CURRENCY_DIRECTORY: Address = '0x15F344b9E6c3Cb6F0376A36A64928b13F62C6276'

const USDC_DECIMALS = 6
const CSV_HEADER = ['payout_id', 'address', 'amount_usdc']

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const { values: args } = parseArgs({
  options: {
    csv: { type: 'string' },
    journal: { type: 'string', default: 'state/payouts.journal.jsonl' },
    'expect-count': { type: 'string' },
    'expect-total': { type: 'string' },
    'max-per-recipient': { type: 'string', default: '10000' },
    'fee-currency': { type: 'string', default: 'celo' }, // celo | usdc
    'allow-duplicate-addresses': { type: 'boolean', default: false },
    execute: { type: 'boolean', default: false },
  },
  strict: true,
})

function die(msg: string): never {
  console.error(`\nABORT: ${msg}`)
  process.exit(1)
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) die(`${name} is not set`)
  return v
}

// ---------------------------------------------------------------------------
// CSV parsing and validation. Anything suspicious aborts the whole run before any
// transaction is built: a half-paid batch is worse than a rejected file.
// ---------------------------------------------------------------------------
type Row = { line: number; payoutId: string; to: Address; amount: bigint }

function parseCsv(path: string, opsAddress: Address): Row[] {
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/)
  const header = lines[0]?.split(',').map((s) => s.trim())
  if (JSON.stringify(header) !== JSON.stringify(CSV_HEADER))
    die(`CSV header must be exactly "${CSV_HEADER.join(',')}", got "${lines[0]}"`)

  const maxPer = parseUnits(args['max-per-recipient']!, USDC_DECIMALS)
  const rows: Row[] = []
  const errors: string[] = []
  const ids = new Set<string>()
  const addrs = new Map<string, number>()

  lines.slice(1).forEach((raw, i) => {
    const line = i + 2
    if (raw.trim() === '') return
    const cols = raw.split(',').map((s) => s.trim())
    if (cols.length !== 3) return errors.push(`line ${line}: expected 3 columns, got ${cols.length}`)
    const [payoutId, addr, amt] = cols

    if (!/^[A-Za-z0-9._:-]{1,64}$/.test(payoutId)) errors.push(`line ${line}: bad payout_id "${payoutId}"`)
    else if (ids.has(payoutId)) errors.push(`line ${line}: duplicate payout_id "${payoutId}"`)
    ids.add(payoutId)

    // strict: a mixed-case address must carry a valid EIP-55 checksum.
    if (!isAddress(addr, { strict: true })) return errors.push(`line ${line}: invalid address / bad checksum "${addr}"`)
    const to = getAddress(addr)
    if (isAddressEqual(to, zeroAddress)) errors.push(`line ${line}: zero address`)
    if (isAddressEqual(to, USDC) || isAddressEqual(to, USDC_FEE_ADAPTER))
      errors.push(`line ${line}: recipient is the USDC contract — funds would be lost`)
    if (isAddressEqual(to, opsAddress)) errors.push(`line ${line}: recipient is the ops wallet itself`)

    if (!/^\d+(\.\d{1,6})?$/.test(amt)) return errors.push(`line ${line}: amount "${amt}" must be a plain decimal with ≤6 places`)
    const amount = parseUnits(amt, USDC_DECIMALS)
    if (amount === 0n) errors.push(`line ${line}: zero amount`)
    if (amount > maxPer) errors.push(`line ${line}: ${amt} USDC exceeds --max-per-recipient ${args['max-per-recipient']}`)

    const key = to.toLowerCase()
    if (addrs.has(key) && !args['allow-duplicate-addresses'])
      errors.push(`line ${line}: address ${to} also on line ${addrs.get(key)} (pass --allow-duplicate-addresses if intended)`)
    addrs.set(key, line)

    rows.push({ line, payoutId, to, amount })
  })

  if (errors.length) die(`CSV failed validation:\n  ${errors.join('\n  ')}`)
  if (rows.length === 0) die('CSV has no rows')
  return rows
}

// ---------------------------------------------------------------------------
// Journal: append-only JSONL, fsync'd on every write. The last entry per payout_id wins.
// ---------------------------------------------------------------------------
type JournalEntry = {
  payoutId: string
  to: Address
  amount: string // base units
  status: 'signed' | 'confirmed' | 'reverted'
  hash: Hash
  nonce: number
  raw?: Hex // signed tx, kept so an unconfirmed tx can be rebroadcast byte-for-byte
  block?: string
  at: string
}

class Journal {
  private fd: number
  readonly latest = new Map<string, JournalEntry>()

  constructor(readonly path: string) {
    mkdirSync(dirname(path), { recursive: true })
    if (existsSync(path)) {
      for (const l of readFileSync(path, 'utf8').split('\n')) {
        if (!l.trim()) continue
        const e = JSON.parse(l) as JournalEntry
        this.latest.set(e.payoutId, e)
      }
    }
    this.fd = openSync(path, 'a')
  }

  append(e: Omit<JournalEntry, 'at'>) {
    const entry = { ...e, at: new Date().toISOString() }
    writeSync(this.fd, JSON.stringify(entry) + '\n')
    fsyncSync(this.fd)
    this.latest.set(e.payoutId, entry)
  }
}

// Single-operator lock: two concurrent runs from the same key would race on nonces.
function acquireLock(path: string) {
  const lock = `${path}.lock`
  try {
    const fd = openSync(lock, 'wx')
    writeSync(fd, `${process.pid} ${new Date().toISOString()}\n`)
    closeSync(fd)
  } catch {
    die(`lock file ${lock} exists — another run may be in progress. Remove it only after confirming no other run is live.`)
  }
  const release = () => existsSync(lock) && unlinkSync(lock)
  process.on('exit', release)
  process.on('SIGINT', () => process.exit(130))
  process.on('SIGTERM', () => process.exit(143))
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (!args.csv) die('--csv is required')
  const feeMode = args['fee-currency']
  if (feeMode !== 'celo' && feeMode !== 'usdc') die('--fee-currency must be "celo" or "usdc"')

  const account = privateKeyToAccount(requireEnv('OPS_PRIVATE_KEY') as Hex)
  const transport = http(requireEnv('CELO_RPC_URL'), { retryCount: 3, timeout: 20_000 })
  const publicClient = createPublicClient({ chain: celo, transport })
  const walletClient = createWalletClient({ chain: celo, transport, account })

  const rows = parseCsv(args.csv, account.address)
  const csvTotal = rows.reduce((s, r) => s + r.amount, 0n)

  // --- preflight: are we on the chain and contracts we think we are? -------
  const chainId = await publicClient.getChainId()
  if (chainId !== CELO_CHAIN_ID) die(`RPC chain id ${chainId}, expected ${CELO_CHAIN_ID} (Celo mainnet)`)
  const [symbol, decimals] = await Promise.all([
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'symbol' }),
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'decimals' }),
  ])
  if (symbol !== 'USDC' || decimals !== USDC_DECIMALS) die(`token at ${USDC} is ${symbol}/${decimals}, expected USDC/6`)

  let feeCurrency: Address | undefined
  if (feeMode === 'usdc') {
    const [listed, adapted] = await Promise.all([
      publicClient.readContract({
        address: FEE_CURRENCY_DIRECTORY,
        abi: parseAbi(['function getCurrencies() view returns (address[])']),
        functionName: 'getCurrencies',
      }),
      publicClient.readContract({
        address: USDC_FEE_ADAPTER,
        abi: parseAbi(['function adaptedToken() view returns (address)']),
        functionName: 'adaptedToken',
      }),
    ])
    if (!listed.some((a) => isAddressEqual(a, USDC_FEE_ADAPTER))) die('USDC adapter is no longer in the FeeCurrencyDirectory')
    if (!isAddressEqual(adapted, USDC)) die(`fee adapter wraps ${adapted}, not USDC`)
    feeCurrency = USDC_FEE_ADAPTER
  }

  // --- reconcile CSV against the journal -----------------------------------
  const journal = new Journal(args.journal!)
  for (const r of rows) {
    const prev = journal.latest.get(r.payoutId)
    if (prev && (!isAddressEqual(prev.to, r.to) || BigInt(prev.amount) !== r.amount))
      die(
        `payout_id ${r.payoutId} is already in the journal as ${formatUnits(BigInt(prev.amount), 6)} USDC to ${prev.to} ` +
          `(${prev.status}, ${prev.hash}) but the CSV now says ${formatUnits(r.amount, 6)} to ${r.to}. ` +
          'payout_ids must never be reused; fix the CSV.',
      )
  }
  const done = rows.filter((r) => journal.latest.get(r.payoutId)?.status === 'confirmed')
  const inFlight = rows.filter((r) => journal.latest.get(r.payoutId)?.status === 'signed')
  const reverted = rows.filter((r) => journal.latest.get(r.payoutId)?.status === 'reverted')
  const todo = rows.filter((r) => !journal.latest.has(r.payoutId))
  const todoTotal = [...todo, ...inFlight].reduce((s, r) => s + r.amount, 0n)

  // --- balances ------------------------------------------------------------
  const [usdcBal, celoBal, gasPrice] = await Promise.all([
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
    publicClient.getBalance({ address: account.address }),
    // Celo's eth_gasPrice takes an optional fee currency and quotes in that currency's units.
    feeCurrency
      ? publicClient.request({ method: 'eth_gasPrice', params: [feeCurrency] } as any).then((p) => BigInt(p as Hex))
      : publicClient.getGasPrice(),
  ])
  // Rough per-transfer gas budget; CIP-64 adds ~50k of fee-currency debit/credit overhead.
  const gasPerTx = feeCurrency ? 120_000n : 70_000n
  const feeBudget = gasPerTx * gasPrice * BigInt(todo.length + inFlight.length) * 3n // 3x headroom

  console.log(`
Ops wallet        ${account.address}
Chain             Celo mainnet (${chainId})
Gas paid in       ${feeMode.toUpperCase()}${feeCurrency ? ` via adapter ${feeCurrency}` : ''}
CSV               ${args.csv}: ${rows.length} rows, ${formatUnits(csvTotal, 6)} USDC
Journal           ${args.journal}
  confirmed       ${done.length}
  in flight       ${inFlight.length}
  reverted        ${reverted.length}
  to send         ${todo.length}   (${formatUnits(todoTotal, 6)} USDC incl. in-flight)
USDC balance      ${formatUnits(usdcBal, 6)}
CELO balance      ${formatEther(celoBal)}
Fee budget (3x)   ~${feeCurrency ? `${formatUnits(feeBudget, 18)} USDC` : `${formatEther(feeBudget)} CELO`}
`)

  if (reverted.length)
    die(`${reverted.length} payout(s) reverted on-chain (${reverted.map((r) => r.payoutId).join(', ')}). ` +
      'Investigate, then either remove them from the CSV or issue them under new payout_ids.')

  // Finance's sign-off numbers must match the file, or nothing moves.
  if (args.execute) {
    if (!args['expect-count'] || !args['expect-total'])
      die('--execute requires --expect-count and --expect-total from the approved payout sheet')
    if (Number(args['expect-count']) !== rows.length) die(`CSV has ${rows.length} rows, approval says ${args['expect-count']}`)
    if (parseUnits(args['expect-total'], 6) !== csvTotal)
      die(`CSV total ${formatUnits(csvTotal, 6)} USDC ≠ approved total ${args['expect-total']}`)
  }

  // Adapter fees are quoted with 18 decimals; USDC has 6.
  const usdcNeeded = todoTotal + (feeCurrency ? feeBudget / 10n ** 12n : 0n)
  if (usdcBal < usdcNeeded) die(`USDC balance ${formatUnits(usdcBal, 6)} < needed ${formatUnits(usdcNeeded, 6)}`)
  if (!feeCurrency && celoBal < feeBudget) die(`CELO balance ${formatEther(celoBal)} < fee budget ${formatEther(feeBudget)}`)

  // Simulate every outstanding transfer before sending any. Catches blocklisted recipients,
  // paused token, etc. while the batch is still all-or-nothing.
  for (const r of todo) {
    await publicClient
      .simulateContract({ account, address: USDC, abi: erc20Abi, functionName: 'transfer', args: [r.to, r.amount] })
      .catch((e) => die(`simulation failed for ${r.payoutId} → ${r.to}: ${e.shortMessage ?? e.message}`))
  }
  console.log(`Simulated ${todo.length} transfers: all OK.`)

  if (!args.execute) {
    console.log('\nDRY RUN — nothing was signed or broadcast. Re-run with --execute (and --expect-*) to pay.')
    return
  }

  acquireLock(args.journal!)

  // --- 1. resolve anything left in flight by a previous run ----------------
  for (const r of inFlight) {
    const e = journal.latest.get(r.payoutId)!
    console.log(`Resolving in-flight ${r.payoutId} (${e.hash}, nonce ${e.nonce})`)
    await settle(e, true)
  }

  // --- 2. send new payouts, strictly one at a time -------------------------
  // Sequential with an explicit nonce: simple to reason about and to resume. At 1s blocks,
  // throughput is ~1 payout every 1-3s.
  let nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' })
  const latestNonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'latest' })
  if (nonce !== latestNonce)
    die(`ops wallet has ${nonce - latestNonce} pending tx(s) not in the journal — something else is using this key`)

  for (const [i, r] of todo.entries()) {
    const request = await walletClient.prepareTransactionRequest({
      to: USDC,
      data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [r.to, r.amount] }),
      value: 0n,
      nonce,
      ...(feeCurrency ? { feeCurrency } : {}),
    })
    const raw = await walletClient.signTransaction(request as any)
    const hash = keccak256(raw)

    // Journal BEFORE broadcast: if we die after this line the next run finds and settles it.
    const entry = { payoutId: r.payoutId, to: r.to, amount: r.amount.toString(), status: 'signed' as const, hash, nonce, raw }
    journal.append(entry)
    await publicClient.sendRawTransaction({ serializedTransaction: raw })
    console.log(`[${i + 1}/${todo.length}] ${r.payoutId}  ${formatUnits(r.amount, 6)} USDC → ${r.to}  ${hash}`)
    await settle(entry, false)
    nonce++
  }

  console.log(`\nDone. ${rows.length} rows in CSV, all confirmed. Journal: ${args.journal}`)

  // Waits for the receipt of a journaled tx and records the outcome. For an entry from a
  // previous run, rebroadcasts the identical signed bytes if the network has forgotten it —
  // same nonce, same hash, so it cannot pay twice.
  async function settle(e: Omit<JournalEntry, 'at'>, recovering: boolean) {
    if (recovering) {
      const existing = await publicClient.getTransactionReceipt({ hash: e.hash }).catch(() => null)
      if (!existing) {
        const mined = await publicClient.getTransactionCount({ address: account.address, blockTag: 'latest' })
        if (mined > e.nonce)
          die(`nonce ${e.nonce} was consumed by a different tx; ${e.payoutId} (${e.hash}) never landed. Manual review required.`)
        if (!e.raw) die(`no raw tx stored for ${e.payoutId}`)
        await publicClient.sendRawTransaction({ serializedTransaction: e.raw }).catch((err) => {
          if (!/already known|nonce too low/i.test(String(err?.details ?? err?.message))) throw err
        })
      }
    }
    const receipt = await publicClient.waitForTransactionReceipt({ hash: e.hash, timeout: 120_000 })
    const status = receipt.status === 'success' ? 'confirmed' : 'reverted'
    journal.append({ ...e, raw: undefined, status, block: receipt.blockNumber.toString() })
    if (status === 'reverted') die(`${e.payoutId} reverted in block ${receipt.blockNumber} (${e.hash}). Stopping.`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
