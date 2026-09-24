/**
 * payout.ts — pay USDC to a list of recipients on Celo from the ops wallet.
 *
 *   npx tsx payout.ts <payouts.csv> --expect-total <USDC> --expect-count <N>            # dry run (default)
 *   npx tsx payout.ts <payouts.csv> --expect-total <USDC> --expect-count <N> --execute  # broadcast
 *
 * CSV: header row `id,address,amount`; one payout per line.
 *   id      unique payout reference from the remittance system (idempotency key)
 *   address recipient on Celo (0x…, 40 hex chars; mixed case must be a valid checksum)
 *   amount  USDC as a decimal string, max 6 decimals, e.g. 125.5
 *
 * Every transaction is signed, written to a journal next to the CSV, and only then
 * broadcast. Re-running the same command after a crash or timeout resumes: paid rows
 * are skipped, in-flight rows are re-checked or re-broadcast byte-for-byte, and nothing
 * is paid twice. See NOTES.md.
 *
 * Env:
 *   CELO_RPC_URL      Celo RPC (default: forno.celo.org — use a dedicated provider in prod)
 *   OPS_PRIVATE_KEY   ops wallet key; required only with --execute
 *   OPS_ADDRESS       ops wallet address; enough for a dry run without key access
 *   PAYOUT_GAS_TOKEN  `usdc` (default: gas paid in USDC via CIP-64) or `celo`
 *   MAX_PAYOUT_USDC   optional per-row ceiling; any row above it aborts the run
 */
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseUnits,
  zeroAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo } from 'viem/chains'

// Circle-native USDC on Celo, and the fee-currency adapter that the FeeCurrencyDirectory
// allowlists for paying gas in USDC. Gas must be paid through the adapter, not the token:
// the adapter scales USDC's 6 decimals to the 18 the protocol expects.
// Both read off chain 2026-09-21 (USDC.symbol/decimals, adapter.adaptedToken()).
const USDC: Address = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C'
const USDC_FEE_ADAPTER: Address = '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B'
const USDC_DECIMALS = 6
const FEE_CURRENCY_DIRECTORY: Address = '0x15F344b9E6c3Cb6F0376A36A64928b13F62C6276'
const GAS_HEADROOM_BPS = 12_000n // gas limit = estimate × 1.2

type Row = { line: number; id: string; to: Address; amount: bigint }
type JournalEntry = {
  id: string
  to: Address
  amount: string
  nonce: number
  hash: Hex
  raw: Hex
  csvSha256: string
  signedAt: string
}

function die(msg: string): never {
  console.error(`\nABORT: ${msg}`)
  process.exit(1)
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i === -1 ? undefined : process.argv[i + 1]
}

function parseUsdc(s: string, where: string): bigint {
  if (!/^\d+(\.\d{1,6})?$/.test(s)) die(`${where}: amount "${s}" is not a plain decimal with at most 6 places`)
  const v = parseUnits(s, USDC_DECIMALS)
  if (v <= 0n) die(`${where}: amount must be positive`)
  return v
}

function parseCsv(path: string): Row[] {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '')
  const lines = text.split(/\r?\n/)
  const header = lines[0]?.split(',').map((h) => h.trim().toLowerCase())
  if (header?.join(',') !== 'id,address,amount') die(`CSV header must be exactly "id,address,amount", got "${lines[0]}"`)

  const maxPer = process.env.MAX_PAYOUT_USDC ? parseUsdc(process.env.MAX_PAYOUT_USDC, 'MAX_PAYOUT_USDC') : undefined
  const rows: Row[] = []
  const ids = new Set<string>()
  const seenAddr = new Map<string, number>()
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i].trim()
    if (raw === '') continue
    const where = `line ${i + 1}`
    if (raw.includes('"')) die(`${where}: quoted fields are not supported`)
    const cols = raw.split(',').map((c) => c.trim())
    if (cols.length !== 3) die(`${where}: expected 3 columns, got ${cols.length}`)
    const [id, addr, amt] = cols
    if (!id) die(`${where}: empty id`)
    if (ids.has(id)) die(`${where}: duplicate id "${id}"`)
    ids.add(id)
    // strict: mixed-case input must match its EIP-55 checksum — catches most typos
    if (!isAddress(addr, { strict: true })) die(`${where}: "${addr}" is not a valid address (bad length, hex or checksum)`)
    const to = getAddress(addr)
    if (to === zeroAddress || to === USDC || to === USDC_FEE_ADAPTER) die(`${where}: refusing to pay ${to}`)
    const amount = parseUsdc(amt, where)
    if (maxPer !== undefined && amount > maxPer) die(`${where}: ${amt} USDC exceeds MAX_PAYOUT_USDC=${process.env.MAX_PAYOUT_USDC}`)
    const prev = seenAddr.get(to)
    if (prev) console.warn(`WARN ${where}: ${to} also appears on line ${prev} — confirm both payouts are intended`)
    seenAddr.set(to, i + 1)
    rows.push({ line: i + 1, id, to, amount })
  }
  if (rows.length === 0) die('CSV has no payout rows')
  return rows
}

// Load-balanced RPCs (forno included) intermittently answer "not found" for a mined
// receipt. Every decision here that hinges on "not mined" asks several times first.
async function findReceipt<R>(get: () => Promise<R>): Promise<R | undefined> {
  for (let i = 0; i < 4; i++) {
    const r = await get().catch(() => undefined)
    if (r) return r
    await new Promise((ok) => setTimeout(ok, 1500))
  }
  return undefined
}

function loadJournal(path: string): Map<string, JournalEntry> {
  const m = new Map<string, JournalEntry>()
  if (!existsSync(path)) return m
  for (const l of readFileSync(path, 'utf8').split('\n')) {
    if (!l.trim()) continue
    const e = JSON.parse(l) as JournalEntry
    m.set(e.id, e) // last entry per id wins
  }
  return m
}

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath || csvPath.startsWith('--')) die('usage: payout.ts <payouts.csv> --expect-total <USDC> --expect-count <N> [--execute]')
  const execute = process.argv.includes('--execute')
  const expectTotal = arg('--expect-total')
  const expectCount = arg('--expect-count')
  if (!expectTotal || !expectCount) die('--expect-total and --expect-count are required (they must match the approved payout batch)')

  const gasToken = (process.env.PAYOUT_GAS_TOKEN ?? 'usdc').toLowerCase()
  if (gasToken !== 'usdc' && gasToken !== 'celo') die('PAYOUT_GAS_TOKEN must be "usdc" or "celo"')
  const feeCurrency = gasToken === 'usdc' ? USDC_FEE_ADAPTER : undefined

  const account = process.env.OPS_PRIVATE_KEY ? privateKeyToAccount(process.env.OPS_PRIVATE_KEY as Hex) : undefined
  if (execute && !account) die('--execute requires OPS_PRIVATE_KEY')
  const from: Address = account?.address ?? (process.env.OPS_ADDRESS ? getAddress(process.env.OPS_ADDRESS) : die('set OPS_ADDRESS (dry run) or OPS_PRIVATE_KEY'))
  if (account && process.env.OPS_ADDRESS && getAddress(process.env.OPS_ADDRESS) !== account.address)
    die(`OPS_PRIVATE_KEY is for ${account.address}, but OPS_ADDRESS says ${process.env.OPS_ADDRESS}`)

  // ---- batch integrity -------------------------------------------------------------
  const csvBytes = readFileSync(csvPath)
  const csvSha = createHash('sha256').update(csvBytes).digest('hex')
  const rows = parseCsv(csvPath)
  const total = rows.reduce((s, r) => s + r.amount, 0n)
  if (rows.length !== Number(expectCount)) die(`CSV has ${rows.length} rows, --expect-count says ${expectCount}`)
  if (total !== parseUsdc(expectTotal, '--expect-total'))
    die(`CSV totals ${formatUnits(total, USDC_DECIMALS)} USDC, --expect-total says ${expectTotal}`)

  // Keyed on the CSV path, not its hash: a corrected file must still see what was already paid.
  const journalPath = `${csvPath}.journal.jsonl`
  const journal = loadJournal(journalPath)

  // ---- chain checks ----------------------------------------------------------------
  const transport = http(process.env.CELO_RPC_URL)
  const pub = createPublicClient({ chain: celo, transport })
  const chainId = await pub.getChainId()
  if (chainId !== celo.id) die(`RPC is chain ${chainId}, expected Celo mainnet ${celo.id}`)

  if (feeCurrency) {
    const allowed = await pub.readContract({
      address: FEE_CURRENCY_DIRECTORY,
      abi: [{ type: 'function', name: 'getCurrencies', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]' }] }],
      functionName: 'getCurrencies',
    })
    if (!allowed.map((a) => a.toLowerCase()).includes(USDC_FEE_ADAPTER.toLowerCase()))
      die('USDC fee adapter is no longer allowlisted as a Celo fee currency; set PAYOUT_GAS_TOKEN=celo')
  }

  console.log(`network      Celo mainnet (${chainId})`)
  console.log(`ops wallet   ${from}`)
  console.log(`csv          ${csvPath}  sha256=${csvSha}`)
  console.log(`journal      ${journalPath}  (${journal.size} entries)`)
  console.log(`payouts      ${rows.length}  total ${formatUnits(total, USDC_DECIMALS)} USDC`)
  console.log(`gas paid in  ${gasToken.toUpperCase()}`)

  // ---- reconcile anything already journaled ----------------------------------------
  const confirmedNonce = await pub.getTransactionCount({ address: from, blockTag: 'latest' })
  const done = new Set<string>()
  const inflight: JournalEntry[] = []
  for (const r of rows) {
    const e = journal.get(r.id)
    if (!e) continue
    if (e.to !== r.to || e.amount !== r.amount.toString()) die(`journal entry for id ${r.id} does not match the CSV row — the file was edited after paying`)
    const rc = await findReceipt(() => pub.getTransactionReceipt({ hash: e.hash }))
    if (rc?.status === 'success') done.add(r.id)
    else if (rc?.status === 'reverted') die(`id ${r.id} tx ${e.hash} REVERTED on chain — resolve manually before re-running`)
    else if (e.nonce < confirmedNonce)
      die(`id ${r.id}: journaled tx ${e.hash} (nonce ${e.nonce}) is not on chain, but that nonce was consumed by another transaction. Investigate before paying again.`)
    else inflight.push(e)
  }
  const todo = rows.filter((r) => !done.has(r.id) && !inflight.some((e) => e.id === r.id))
  const remaining = [...todo.map((r) => r.amount), ...inflight.map((e) => BigInt(e.amount))].reduce((s, a) => s + a, 0n)
  console.log(`already paid ${done.size}   in flight ${inflight.length}   to send ${todo.length}   remaining ${formatUnits(remaining, USDC_DECIMALS)} USDC`)

  // ---- balances --------------------------------------------------------------------
  const usdcBal = await pub.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [from] })
  const celoBal = await pub.getBalance({ address: from })
  const fees = await pub.estimateFeesPerGas({ request: { feeCurrency } } as never)
  // An ERC-20 transfer plus fee-currency debit/credit is well under 150k gas; this is a
  // conservative ceiling for the pre-flight check, not what is actually charged.
  const gasCeiling = BigInt(todo.length) * 150_000n * fees.maxFeePerGas
  const gasCeilingUsdc = feeCurrency ? gasCeiling / 10n ** 12n : 0n // adapter prices gas in 18-dec USDC
  console.log(`USDC balance ${formatUnits(usdcBal, USDC_DECIMALS)}   CELO balance ${formatUnits(celoBal, 18)}`)
  console.log(`gas ceiling  ${feeCurrency ? `${formatUnits(gasCeilingUsdc, USDC_DECIMALS)} USDC` : `${formatUnits(gasCeiling, 18)} CELO`}`)
  if (usdcBal < remaining + gasCeilingUsdc) die('USDC balance does not cover the remaining payouts plus gas')
  if (!feeCurrency && celoBal < gasCeiling) die('CELO balance does not cover gas')

  // ---- simulate every remaining transfer before sending any ------------------------
  // Catches USDC blocklisted recipients/sender and a paused token before the batch is half-paid.
  for (const r of todo) {
    await pub
      .simulateContract({ account: from, address: USDC, abi: erc20Abi, functionName: 'transfer', args: [r.to, r.amount] })
      .catch((e) => die(`line ${r.line} id ${r.id}: transfer to ${r.to} would revert: ${e.shortMessage ?? e.message}`))
  }
  console.log('simulation   all remaining transfers succeed against current state')

  if (!execute) {
    console.log('\nDRY RUN — nothing signed or sent. Re-run with --execute to pay.')
    return
  }

  // ---- send ------------------------------------------------------------------------
  const wallet = createWalletClient({ account: account!, chain: celo, transport })

  const confirm = async (e: JournalEntry) => {
    const rc = await pub.waitForTransactionReceipt({ hash: e.hash, timeout: 180_000 }).catch(() => undefined)
    if (!rc) die(`id ${e.id}: no receipt for ${e.hash} after 3 minutes. Re-run the same command to resume; do not edit the CSV.`)
    if (rc.status !== 'success') die(`id ${e.id}: tx ${e.hash} REVERTED. Stopped; later rows were not sent.`)
    console.log(`  confirmed  block ${rc.blockNumber}`)
  }

  for (const e of inflight) {
    console.log(`rebroadcast  id ${e.id} nonce ${e.nonce} ${e.hash}`)
    await pub.sendRawTransaction({ serializedTransaction: e.raw }).catch((err) => {
      // "already known" / "nonce too low" just mean the node already has or mined it
      console.warn(`  node said: ${err.shortMessage ?? err.message}`)
    })
    await confirm(e)
  }

  let nonce = await pub.getTransactionCount({ address: from, blockTag: 'pending' })
  for (const r of todo) {
    const data = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [r.to, r.amount] })
    const est = await pub.estimateGas({ account: from, to: USDC, data, feeCurrency } as never)
    const f = await pub.estimateFeesPerGas({ request: { feeCurrency } } as never)
    const raw = await wallet.signTransaction({
      account: account!,
      chain: celo,
      to: USDC,
      data,
      nonce,
      gas: (est * GAS_HEADROOM_BPS) / 10_000n,
      maxFeePerGas: f.maxFeePerGas,
      maxPriorityFeePerGas: f.maxPriorityFeePerGas,
      ...(feeCurrency ? { feeCurrency } : {}),
    } as never)
    const entry: JournalEntry = {
      id: r.id,
      to: r.to,
      amount: r.amount.toString(),
      nonce,
      hash: keccak256(raw),
      raw,
      csvSha256: csvSha,
      signedAt: new Date().toISOString(),
    }
    // journal BEFORE broadcast: a crash between here and the receipt is recoverable
    appendFileSync(journalPath, `${JSON.stringify(entry)}\n`)
    await pub.sendRawTransaction({ serializedTransaction: raw })
    console.log(`sent         id ${r.id} ${formatUnits(r.amount, USDC_DECIMALS)} USDC → ${r.to}  nonce ${nonce}  ${entry.hash}`)
    await confirm(entry)
    nonce++
  }
  console.log(`\nDONE: ${rows.length} payouts confirmed. Journal: ${journalPath}`)
}

main().catch((e) => die(e?.shortMessage ?? e?.message ?? String(e)))
