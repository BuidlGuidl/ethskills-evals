// Pays USDC on Celo to every row of a CSV, from the ops wallet.
//
//   npx tsx payout.ts <payouts.csv>                                  # dry run (default)
//   npx tsx payout.ts <payouts.csv> --execute --confirm-total 1234.56
//
// CSV header must be exactly: payout_id,address,amount_usdc
// payout_id is the idempotency key: a payout_id that has been paid is never
// paid again, across re-runs and across files. See NOTES.md.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  type Address,
  type Hex,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  isAddress,
  isAddressEqual,
  parseEventLogs,
  parseUnits,
} from 'viem'
import {
  CELO_USDC,
  CELO_USDC_FEE_ADAPTER,
  type SignedTx,
  acquireLock,
  assertNoPendingTxs,
  broadcast,
  celoClient,
  die,
  envAddress,
  feeCurrencyFor,
  flag,
  gasCurrency,
  loadSigner,
  option,
  readJson,
  reconcile,
  signTx,
  waitMined,
  writeJson,
  writeText,
} from './shared/ops.ts'

const USDC_DECIMALS = 6
const JOURNAL = 'payouts.json'
const RECEIPT_TIMEOUT_MS = 120_000

type Row = { line: number; payoutId: string; address: Address; amount: bigint }

type JournalEntry = {
  address: Address
  amount: bigint
  batch: string
  status: 'signed' | 'confirmed' | 'reverted'
  tx: SignedTx
  blockNumber?: bigint
  updatedAt: string
}
type Journal = Record<string, JournalEntry>

// ---------------------------------------------------------------------------
// CSV parsing — strict. Any bad row aborts the whole file before anything is sent.
// ---------------------------------------------------------------------------

function parseCsv(path: string, ops: Address): { rows: Row[]; batch: string } {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '')
  const batch = createHash('sha256').update(text).digest('hex').slice(0, 16)
  const lines = text.split(/\r?\n/)
  const header = lines[0]?.split(',').map((h) => h.trim().toLowerCase())
  if (header?.join(',') !== 'payout_id,address,amount_usdc')
    die(`${path}: header must be exactly "payout_id,address,amount_usdc", got "${lines[0]}"`)

  const errors: string[] = []
  const rows: Row[] = []
  const seenIds = new Set<string>()
  const seenAddr = new Map<string, number>()

  lines.slice(1).forEach((raw, i) => {
    const line = i + 2
    if (raw.trim() === '') return
    if (raw.includes('"')) return void errors.push(`line ${line}: quoted fields are not supported`)
    const cols = raw.split(',').map((c) => c.trim())
    if (cols.length !== 3) return void errors.push(`line ${line}: expected 3 columns, got ${cols.length}`)
    const [payoutId, addr, amt] = cols as [string, string, string]

    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(payoutId)) errors.push(`line ${line}: bad payout_id "${payoutId}"`)
    else if (seenIds.has(payoutId)) errors.push(`line ${line}: duplicate payout_id "${payoutId}"`)
    seenIds.add(payoutId)

    if (!isAddress(addr, { strict: false })) return void errors.push(`line ${line}: not an address "${addr}"`)
    if (addr !== addr.toLowerCase() && !isAddress(addr, { strict: true }))
      return void errors.push(`line ${line}: bad EIP-55 checksum "${addr}" (typo?)`)
    const address = getAddress(addr)
    if (/^0x0{40}$/i.test(address)) errors.push(`line ${line}: zero address`)
    for (const [bad, label] of [
      [CELO_USDC, 'the USDC contract'],
      [CELO_USDC_FEE_ADAPTER, 'the USDC fee adapter'],
      [ops, 'the ops wallet itself'],
    ] as const)
      if (isAddressEqual(address, bad)) errors.push(`line ${line}: recipient is ${label}`)

    if (!/^\d+(\.\d{1,6})?$/.test(amt))
      return void errors.push(`line ${line}: amount "${amt}" must be a plain decimal with ≤6 places (no $, commas, exponents)`)
    const amount = parseUnits(amt, USDC_DECIMALS)
    if (amount === 0n) errors.push(`line ${line}: zero amount`)

    const prev = seenAddr.get(address)
    if (prev !== undefined && !flag('--allow-repeat-recipients'))
      errors.push(`line ${line}: ${address} already paid on line ${prev} (pass --allow-repeat-recipients if intended)`)
    seenAddr.set(address, line)

    rows.push({ line, payoutId, address, amount })
  })

  if (errors.length) die(`${path} has ${errors.length} problem(s); nothing was sent:\n  ${errors.join('\n  ')}`)
  if (rows.length === 0) die(`${path} has no payout rows`)
  return { rows, batch }
}

const usd = (v: bigint) => formatUnits(v, USDC_DECIMALS)

// ---------------------------------------------------------------------------

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath || csvPath.startsWith('--')) die('usage: npx tsx payout.ts <payouts.csv> [--execute --confirm-total <USDC>]')
  const execute = flag('--execute')
  const gas = gasCurrency()
  const feeCurrency = feeCurrencyFor(gas)
  const ops = envAddress('OPS_ADDRESS')
  const client = celoClient()

  const chainId = await client.getChainId()
  if (chainId !== 42220) die(`CELO_RPC_URL is chain ${chainId}, expected Celo mainnet 42220`)

  const { rows, batch } = parseCsv(csvPath, ops)
  if (execute) acquireLock('payout')
  const journal = readJson<Journal>(JOURNAL, {})

  // Rows already handled in this or any previous file.
  const todo: Row[] = []
  const done: Row[] = []
  for (const r of rows) {
    const j = journal[r.payoutId]
    if (!j) {
      todo.push(r)
      continue
    }
    if (!isAddressEqual(j.address, r.address) || j.amount !== r.amount)
      die(
        `payout_id ${r.payoutId} (line ${r.line}) was already used for ${usd(j.amount)} USDC → ${j.address} ` +
          `(status ${j.status}, tx ${j.tx.hash}).\nThe CSV now says ${usd(r.amount)} → ${r.address}. ` +
          `payout_ids must never be reused; issue a new id for a new payment.`,
      )
    if (j.status === 'signed') todo.push(r) // needs reconciling, not re-signing
    else done.push(r)
  }

  const total = rows.reduce((a, r) => a + r.amount, 0n)
  const remaining = todo.filter((r) => !journal[r.payoutId]).reduce((a, r) => a + r.amount, 0n)
  const largest = rows.reduce((a, r) => (r.amount > a.amount ? r : a))
  const [usdcBal, celoBal] = await Promise.all([
    client.readContract({ address: CELO_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [ops] }),
    client.getBalance({ address: ops }),
  ])

  console.log(`Batch ${batch}  (${csvPath})`)
  console.log(`  ops wallet          ${ops}`)
  console.log(`  rows                ${rows.length}  (already done: ${done.length}, to send/reconcile: ${todo.length})`)
  console.log(`  file total          ${usd(total)} USDC`)
  console.log(`  still to send       ${usd(remaining)} USDC`)
  console.log(`  largest row         ${usd(largest.amount)} USDC → ${largest.address} (line ${largest.line})`)
  console.log(`  ops USDC balance    ${usd(usdcBal)}`)
  console.log(`  ops CELO balance    ${formatUnits(celoBal, 18)}`)
  console.log(`  gas paid in         ${gas}${feeCurrency ? ` (feeCurrency ${feeCurrency})` : ''}`)

  const maxRow = process.env.PAYOUT_MAX_ROW_USDC?.trim()
  if (maxRow) {
    const cap = parseUnits(maxRow, USDC_DECIMALS)
    const over = rows.filter((r) => r.amount > cap)
    if (over.length)
      die(`${over.length} row(s) exceed PAYOUT_MAX_ROW_USDC=${maxRow}: lines ${over.map((r) => r.line).join(', ')}`)
  }

  // Simulate every outstanding transfer now, so a blocked recipient or a
  // short balance shows up before the first payment, not halfway through.
  const fees = await client.estimateFeesPerGas({ request: feeCurrency ? { feeCurrency } : {} } as any)
  let worstGasCost = 0n // in USDC units (6 dp) or CELO wei
  const failures: string[] = []
  for (const r of todo.filter((r) => !journal[r.payoutId])) {
    try {
      const g = await client.estimateGas({
        account: ops,
        to: CELO_USDC,
        data: transferData(r),
        ...(feeCurrency ? { feeCurrency } : {}),
      } as any)
      // Fee-currency gas prices come back in 18-dp adapter units; USDC has 6.
      const cost = (g * 12n) / 10n * fees.maxFeePerGas!
      worstGasCost += feeCurrency ? cost / 10n ** 12n : cost
    } catch (e) {
      failures.push(`line ${r.line} ${r.payoutId} → ${r.address}: ${(e as any).shortMessage ?? (e as Error).message}`)
    }
  }
  if (failures.length)
    die(`${failures.length} transfer(s) would revert right now (blocklisted recipient, paused token, balance?):\n  ${failures.join('\n  ')}`)

  const gasFmt = feeCurrency ? `${usd(worstGasCost)} USDC` : `${formatUnits(worstGasCost, 18)} CELO`
  console.log(`  max gas for batch   ${gasFmt}`)
  const needUsdc = remaining + (feeCurrency ? worstGasCost : 0n)
  if (usdcBal < needUsdc) die(`ops wallet has ${usd(usdcBal)} USDC, batch needs up to ${usd(needUsdc)} including gas`)
  if (!feeCurrency && celoBal < worstGasCost) die(`ops wallet has too little CELO for gas (need ~${gasFmt})`)

  if (!execute) {
    console.log('\nDry run OK — every outstanding transfer simulates successfully. Nothing was sent.')
    console.log(`To pay: npx tsx payout.ts ${csvPath} --execute --confirm-total ${usd(total)}`)
    return
  }

  // Fat-finger guard: the operator types the total finance approved.
  const confirm = option('--confirm-total')
  if (!confirm || !/^\d+(\.\d{1,6})?$/.test(confirm) || parseUnits(confirm, USDC_DECIMALS) !== total)
    die(`--confirm-total must equal the file total exactly (${usd(total)}). Nothing was sent.`)

  const account = loadSigner('OPS')

  // Settle anything a previous run signed but didn't see confirmed.
  for (const r of todo.filter((r) => journal[r.payoutId]?.status === 'signed')) {
    const j = journal[r.payoutId]!
    console.log(`reconciling ${r.payoutId} (${j.tx.hash}) from an earlier run…`)
    const res = await reconcile(client, j.tx, RECEIPT_TIMEOUT_MS)
    if (res.state === 'pending') die(`${j.tx.hash} still pending — re-run later. Nothing new was sent.`)
    if (res.state === 'nonce-consumed-elsewhere')
      die(
        `${r.payoutId}: nonce ${j.tx.nonce} was used but ${j.tx.hash} has no receipt on this RPC.\n` +
          `Check the ops wallet on celoscan.io. If ${j.tx.hash} is not there, the payment did NOT happen:\n` +
          `delete "${r.payoutId}" from ${JOURNAL} and re-run. If it is there, set its status to "confirmed".`,
      )
    record(journal, r, settle(r, res.receipt, ops), res.receipt.blockNumber)
  }

  let nonce = await assertNoPendingTxs(client, ops)
  const queue = todo.filter((r) => !journal[r.payoutId])
  let paid = 0
  for (const r of queue) {
    const tx = await signTx(client, account, { to: CELO_USDC, data: transferData(r), feeCurrency }, nonce)
    journal[r.payoutId] = {
      address: r.address,
      amount: r.amount,
      batch,
      status: 'signed',
      tx,
      updatedAt: new Date().toISOString(),
    }
    writeJson(JOURNAL, journal) // persisted before broadcast
    await broadcast(client, tx)
    const res = await waitMined(client, tx.hash, RECEIPT_TIMEOUT_MS)
    if (res.state !== 'mined')
      die(`${r.payoutId}: ${tx.hash} not mined within ${RECEIPT_TIMEOUT_MS / 1000}s. Re-run to reconcile; it will not double-pay.`)
    const status = settle(r, res.receipt, ops)
    record(journal, r, status, res.receipt.blockNumber)
    if (status !== 'confirmed')
      die(`${r.payoutId} → ${r.address} REVERTED in ${tx.hash}. Batch stopped; funds for this row did not move.`)
    paid++
    nonce++
    console.log(`  paid ${r.payoutId}  ${usd(r.amount)} USDC → ${r.address}  ${tx.hash}`)
  }

  const report = writeReport(batch, rows, journal)
  console.log(`\nDone. ${paid} sent this run; ${rows.length} rows in file. Reconciliation report: ${report}`)
}

function transferData(r: Row): Hex {
  return encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [r.address, r.amount] })
}

/** Success means the receipt carries the exact USDC Transfer we intended. */
function settle(r: Row, receipt: { status: string; logs: any[] }, ops: Address): 'confirmed' | 'reverted' {
  if (receipt.status !== 'success') return 'reverted'
  const ok = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: receipt.logs }).some(
    (l) =>
      isAddressEqual(l.address, CELO_USDC) &&
      isAddressEqual(l.args.from, ops) &&
      isAddressEqual(l.args.to, r.address) &&
      l.args.value === r.amount,
  )
  if (!ok) die(`${r.payoutId}: tx succeeded but has no matching USDC Transfer event — investigate before continuing`)
  return 'confirmed'
}

function record(journal: Journal, r: Row, status: 'confirmed' | 'reverted', blockNumber: bigint) {
  const j = journal[r.payoutId]!
  j.status = status
  j.blockNumber = blockNumber
  j.updatedAt = new Date().toISOString()
  writeJson(JOURNAL, journal)
}

function writeReport(batch: string, rows: Row[], journal: Journal): string {
  const lines = ['payout_id,address,amount_usdc,status,tx_hash,block_number']
  for (const r of rows) {
    const j = journal[r.payoutId]
    lines.push([r.payoutId, r.address, usd(r.amount), j?.status ?? 'unsent', j?.tx.hash ?? '', j?.blockNumber ?? ''].join(','))
  }
  return writeText(`payout-report-${batch}.csv`, `${lines.join('\n')}\n`)
}

main().catch((e) => die(process.env.DEBUG ? String((e as Error).stack ?? e) : (e as any).shortMessage ?? (e as Error).stack ?? String(e)))
