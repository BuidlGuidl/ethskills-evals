// payout.ts — pay USDC to a list of recipients on Celo from the ops wallet.
//
//   npx tsx payout.ts payouts.csv              dry run: validate, simulate every transfer, print the plan
//   npx tsx payout.ts payouts.csv --execute    broadcast (asks the operator to type a confirmation code)
//
// Options:
//   --confirm <code>               non-interactive confirmation (code is printed by the dry run)
//   --allow-duplicate-recipients   allow the same address on more than one row
//   --retry-reverted               re-attempt rows whose earlier tx reverted
//   --replace-stuck                fee-bump an in-flight tx on its original nonce
//
// CSV format and operating procedure: see NOTES.md.
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { type Address, type Hash, encodeFunctionData, erc20Abi, parseEventLogs } from 'viem'
import {
  CELO_USDC,
  CeloSender,
  LEDGER_DIR,
  OpsError,
  type SignedTx,
  USDC_DECIMALS,
  acquireLock,
  celoClient,
  celoL2,
  celoWallet,
  env,
  fmtCelo,
  fmtUsdc,
  loadAccount,
  parseAddress,
  parseAmount,
  readJson,
  requireConfirmation,
  runMain,
  writeJsonAtomic,
} from './lib.ts'

const PAYOUT_DIR = join(LEDGER_DIR, 'payouts')
const SWEEP_DIR = join(LEDGER_DIR, 'sweeps')
const REPORT_DIR = join(LEDGER_DIR, 'reports')

// Addresses that must never receive a payout.
const CELO_TOKEN_ON_CELO: Address = '0x471EcE3750Da237f93B8E339c536989b8978a438'
const isPredeploy = (a: Address) => a.toLowerCase().startsWith('0x42000000000000000000000000000000000000')

type Row = { line: number; id: string; to: Address; amount: bigint }

type PaymentRecord = {
  id: string
  chainId: number
  token: Address
  from: Address
  to: Address
  amount: string // USDC base units (6 decimals)
  status: 'signed' | 'paid' | 'reverted'
  tx?: SignedTx
  paidTxHash?: Hash
  paidBlock?: string
  failedAttempts?: { tx: SignedTx; revertedTxHash: Hash }[]
  updatedAt: string
}

const recordPath = (id: string) => join(PAYOUT_DIR, `${id.toLowerCase()}.json`)

function readRecord(id: string): PaymentRecord | undefined {
  const record = readJson<PaymentRecord>(recordPath(id))
  if (record && record.id !== id)
    throw new OpsError(`Payment id "${id}" collides with existing ledger entry "${record.id}" (ids are case-insensitive).`)
  return record
}

function writeRecord(record: PaymentRecord) {
  writeJsonAtomic(recordPath(record.id), { ...record, updatedAt: new Date().toISOString() })
}

function parseCsv(path: string, ops: Address, allowDuplicateRecipients: boolean): Row[] {
  const maxRow = parseAmount(env('PAYOUT_MAX_ROW_USDC'), USDC_DECIMALS, 'PAYOUT_MAX_ROW_USDC')
  const maxTotal = parseAmount(env('PAYOUT_MAX_TOTAL_USDC'), USDC_DECIMALS, 'PAYOUT_MAX_TOTAL_USDC')

  const lines = readFileSync(path, 'utf8').replace(/^﻿/, '').split(/\r?\n/)
  const errors: string[] = []
  const rows: Row[] = []
  let header: string[] | undefined

  lines.forEach((raw, i) => {
    const line = raw.trim()
    const where = `line ${i + 1}`
    if (!line || line.startsWith('#')) return
    if (line.includes('"')) {
      errors.push(`${where}: quoted fields are not supported; export a plain CSV`)
      return
    }
    const cells = line.split(',').map((c) => c.trim())
    if (!header) {
      header = cells.map((c) => c.toLowerCase())
      for (const col of ['id', 'address', 'amount'])
        if (!header.includes(col)) errors.push(`header must contain column "${col}" (got: ${line})`)
      return
    }
    if (cells.length !== header.length) {
      errors.push(`${where}: expected ${header.length} columns, got ${cells.length}`)
      return
    }
    const cell = (name: string) => cells[header!.indexOf(name)]!
    try {
      const id = cell('id')
      if (!/^[A-Za-z0-9._-]{1,100}$/.test(id)) throw new OpsError(`id "${id}" must be 1-100 chars of A-Z a-z 0-9 . _ -`)
      const to = parseAddress(cell('address'), 'address')
      if (to === ops) throw new OpsError('recipient is the ops wallet itself')
      if (to === CELO_USDC || to === CELO_TOKEN_ON_CELO || isPredeploy(to))
        throw new OpsError(`recipient ${to} is a token/system contract`)
      const amount = parseAmount(cell('amount'), USDC_DECIMALS, 'amount')
      if (amount === 0n) throw new OpsError('amount is zero')
      if (amount > maxRow) throw new OpsError(`amount ${fmtUsdc(amount)} exceeds PAYOUT_MAX_ROW_USDC`)
      rows.push({ line: i + 1, id, to, amount })
    } catch (err) {
      if (!(err instanceof OpsError)) throw err
      errors.push(`${where}: ${err.message}`)
    }
  })

  if (!header) errors.push('file is empty')
  const seenIds = new Map<string, number>()
  const seenTo = new Map<Address, number>()
  for (const r of rows) {
    const key = r.id.toLowerCase()
    if (seenIds.has(key)) errors.push(`line ${r.line}: duplicate id "${r.id}" (first on line ${seenIds.get(key)})`)
    seenIds.set(key, r.line)
    if (seenTo.has(r.to) && !allowDuplicateRecipients)
      errors.push(
        `line ${r.line}: ${r.to} already paid on line ${seenTo.get(r.to)} ` +
          `(pass --allow-duplicate-recipients if intentional)`,
      )
    seenTo.set(r.to, r.line)
  }
  const total = rows.reduce((s, r) => s + r.amount, 0n)
  if (total > maxTotal) errors.push(`batch total ${fmtUsdc(total)} exceeds PAYOUT_MAX_TOTAL_USDC`)
  if (rows.length === 0 && errors.length === 0) errors.push('no payment rows')

  if (errors.length) throw new OpsError(`CSV ${path} rejected:\n  - ${errors.join('\n  - ')}`)
  return rows
}

/**
 * Every in-flight tx from the ops wallet reserves a nonce. Refuse to start if one
 * exists that this run won't resolve first (another CSV's payment, or a sweep).
 */
function assertNothingElseInFlight(work: Row[]) {
  const ours = new Set(work.map((r) => r.id.toLowerCase()))
  if (existsSync(PAYOUT_DIR))
    for (const f of readdirSync(PAYOUT_DIR).filter((f) => f.endsWith('.json'))) {
      const rec = readJson<PaymentRecord>(join(PAYOUT_DIR, f))
      if (rec?.status === 'signed' && !ours.has(rec.id.toLowerCase()))
        throw new OpsError(`Payment ${rec.id} (another CSV) has an unconfirmed tx. Re-run that CSV first.`)
    }
  if (!existsSync(SWEEP_DIR)) return
  for (const f of readdirSync(SWEEP_DIR).filter((f) => f.endsWith('.json'))) {
    const s = readJson<{ status: string }>(join(SWEEP_DIR, f))
    if (s?.status === 'initiate-signed')
      throw new OpsError(`Sweep ${f} has an unconfirmed Celo tx. Resolve it (sweep.ts initiate) first.`)
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i]!)
      }
    }),
  )
  return out
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      execute: { type: 'boolean', default: false },
      confirm: { type: 'string' },
      'allow-duplicate-recipients': { type: 'boolean', default: false },
      'retry-reverted': { type: 'boolean', default: false },
      'replace-stuck': { type: 'boolean', default: false },
    },
  })
  const csvPath = positionals[0]
  if (!csvPath || positionals.length > 1) throw new OpsError('Usage: npx tsx payout.ts <payouts.csv> [--execute]')

  const ops = parseAddress(env('OPS_ADDRESS'), 'OPS_ADDRESS')
  const rows = parseCsv(csvPath, ops, values['allow-duplicate-recipients']!)
  const client = await celoClient()

  // Make sure CELO_USDC really is 6-decimal USDC before trusting any amount math.
  const [symbol, decimals] = await Promise.all([
    client.readContract({ address: CELO_USDC, abi: erc20Abi, functionName: 'symbol' }),
    client.readContract({ address: CELO_USDC, abi: erc20Abi, functionName: 'decimals' }),
  ])
  if (symbol !== 'USDC' || decimals !== USDC_DECIMALS)
    throw new OpsError(`${CELO_USDC} reports ${symbol}/${decimals}; expected USDC/6. Refusing.`)

  // Reconcile the CSV against the ledger.
  const toSend: Row[] = []
  const resuming: Row[] = []
  let alreadyPaid = 0
  const skippedReverted: Row[] = []
  for (const row of rows) {
    const rec = readRecord(row.id)
    if (!rec) {
      toSend.push(row)
      continue
    }
    if (rec.to !== row.to || rec.amount !== row.amount.toString())
      throw new OpsError(
        `Payment id "${row.id}" is already in the ledger as ${fmtUsdc(BigInt(rec.amount))} to ${rec.to}; ` +
          `the CSV now says ${fmtUsdc(row.amount)} to ${row.to}. Ids must never be reused.`,
      )
    if (rec.status === 'paid') alreadyPaid++
    else if (rec.status === 'signed') resuming.push(row)
    else if (values['retry-reverted']) toSend.push(row)
    else skippedReverted.push(row)
  }

  const newTotal = toSend.reduce((s, r) => s + r.amount, 0n)
  const resumeTotal = resuming.reduce((s, r) => s + r.amount, 0n)
  const [usdcBalance, celoBalance, gasPrice] = await Promise.all([
    client.readContract({ address: CELO_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [ops] }),
    client.getBalance({ address: ops }),
    client.getGasPrice(),
  ])

  // Simulate every new transfer from the ops wallet (catches e.g. USDC-blocklisted addresses).
  const problems: string[] = []
  const warnings: string[] = []
  let gasPerTransfer = 0n
  await mapLimit(toSend, 6, async (row) => {
    try {
      await client.simulateContract({
        account: ops,
        address: CELO_USDC,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [row.to, row.amount],
      })
      const gas = await client.estimateContractGas({
        account: ops,
        address: CELO_USDC,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [row.to, row.amount],
      })
      if (gas > gasPerTransfer) gasPerTransfer = gas
    } catch (err: any) {
      problems.push(`${row.id} -> ${row.to}: transfer simulation failed: ${err?.shortMessage ?? err}`)
    }
    if (await client.getCode({ address: row.to }))
      warnings.push(`${row.id}: ${row.to} is a contract on Celo — confirm it can handle USDC (e.g. a smart wallet).`)
  })
  const gasBudget = gasPerTransfer * BigInt(toSend.length + resuming.length) * gasPrice * 2n

  if (newTotal > usdcBalance)
    problems.push(`ops wallet holds ${fmtUsdc(usdcBalance)} but this run needs ${fmtUsdc(newTotal)}`)
  if (gasBudget > celoBalance)
    problems.push(`ops wallet holds ${fmtCelo(celoBalance)}; budget ${fmtCelo(gasBudget)} for gas`)

  // Plan.
  console.log(`\nPayout plan — Celo mainnet, token ${CELO_USDC} (USDC)`)
  console.log(`  from (ops wallet):   ${ops}`)
  console.log(`  csv rows:            ${rows.length}`)
  console.log(`  already paid:        ${alreadyPaid} (skipped)`)
  if (skippedReverted.length)
    console.log(`  reverted earlier:    ${skippedReverted.length} (skipped; --retry-reverted to re-attempt)`)
  if (resuming.length)
    console.log(`  in flight (resume):  ${resuming.length} totalling ${fmtUsdc(resumeTotal)} — may already be paid`)
  console.log(`  to send now:         ${toSend.length} totalling ${fmtUsdc(newTotal)}`)
  console.log(`  USDC balance:        ${fmtUsdc(usdcBalance)}`)
  console.log(`  CELO balance:        ${fmtCelo(celoBalance)} (gas budget ~${fmtCelo(gasBudget)})`)
  console.log('')
  for (const r of [...resuming, ...toSend])
    console.log(`  ${resuming.includes(r) ? 'RESUME' : 'SEND  '}  ${r.id.padEnd(24)} ${r.to}  ${fmtUsdc(r.amount)}`)
  for (const w of warnings) console.log(`\nWARNING: ${w}`)
  if (problems.length) throw new OpsError(`Pre-flight failed:\n  - ${problems.join('\n  - ')}`)

  // In-flight rows hold the lowest nonces, so they must be resolved before anything new is signed.
  const work = [...resuming, ...toSend]
  if (work.length === 0) {
    console.log('\nNothing to send.')
    return
  }

  const code = createHash('sha256')
    .update([celoL2.id, ops, ...work.map((r) => `${r.id}:${r.to}:${r.amount}`)].join('|'))
    .digest('hex')
    .slice(0, 8)
    .toUpperCase()

  if (!values.execute) {
    console.log(`\nDRY RUN — nothing sent. To broadcast exactly this plan:`)
    console.log(`  npx tsx payout.ts ${csvPath} --execute --confirm ${code}`)
    return
  }

  // Execute.
  const account = loadAccount('OPS_PRIVATE_KEY', 'OPS_ADDRESS')
  const release = acquireLock(`payout ${csvPath}`)
  const results: { row: Row; status: string; hash?: Hash; block?: bigint }[] = []
  try {
    assertNothingElseInFlight(work)
    await requireConfirmation(code, values.confirm)
    const sender = new CeloSender(client, celoWallet(account), account)

    for (const row of work) {
      const prior = readRecord(row.id)
      const base: PaymentRecord = prior ?? {
        id: row.id,
        chainId: celoL2.id,
        token: CELO_USDC,
        from: ops,
        to: row.to,
        amount: row.amount.toString(),
        status: 'signed',
        updatedAt: '',
      }
      // A reverted row being retried: archive the failed attempt and start fresh.
      if (base.status === 'reverted') {
        base.failedAttempts = [
          ...(base.failedAttempts ?? []),
          { tx: base.tx!, revertedTxHash: base.paidTxHash! },
        ]
        delete base.tx
        delete base.paidTxHash
      }

      let receipt
      try {
        receipt = await sender.sendOnce({
          call: {
            to: CELO_USDC,
            data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [row.to, row.amount] }),
          },
          existing: base.status === 'signed' ? base.tx : undefined,
          persist: (tx) => writeRecord({ ...base, status: 'signed', tx }),
          replaceStuck: values['replace-stuck'],
        })
      } catch (err) {
        const inFlight = readRecord(row.id)?.status === 'signed'
        results.push({ row, status: inFlight ? 'IN FLIGHT - re-run to resume' : 'NOT SENT' })
        throw err
      }

      const current = readRecord(row.id)!
      if (receipt.status !== 'success') {
        writeRecord({ ...current, status: 'reverted', paidTxHash: receipt.transactionHash })
        results.push({ row, status: 'REVERTED', hash: receipt.transactionHash })
        throw new OpsError(`Payment ${row.id} reverted in ${receipt.transactionHash}. Stopping the batch.`)
      }
      const transfers = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: receipt.logs }).filter(
        (l) =>
          l.address.toLowerCase() === CELO_USDC.toLowerCase() &&
          l.args.from === ops &&
          l.args.to === row.to &&
          l.args.value === row.amount,
      )
      if (transfers.length !== 1)
        throw new OpsError(`Tx ${receipt.transactionHash} succeeded but has no matching USDC Transfer. Investigate.`)
      writeRecord({
        ...current,
        status: 'paid',
        paidTxHash: receipt.transactionHash,
        paidBlock: receipt.blockNumber.toString(),
      })
      results.push({ row, status: 'PAID', hash: receipt.transactionHash, block: receipt.blockNumber })
      console.log(`  PAID  ${row.id.padEnd(24)} ${fmtUsdc(row.amount).padStart(20)}  ${receipt.transactionHash}`)
    }
  } finally {
    release()
    if (results.length) {
      mkdirSync(REPORT_DIR, { recursive: true })
      const file = join(REPORT_DIR, `payout-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`)
      const lines = ['id,address,amount_usdc,status,tx_hash,block']
      for (const r of results)
        lines.push([r.row.id, r.row.to, fmtUsdc(r.row.amount).split(' ')[0], r.status, r.hash ?? '', r.block ?? ''].join(','))
      writeFileSync(file, lines.join('\n') + '\n')
      console.log(`\nReport: ${file}`)
    }
  }
  const paid = results.filter((r) => r.status === 'PAID')
  console.log(`\nDone: ${paid.length} paid, ${fmtUsdc(paid.reduce((s, r) => s + r.row.amount, 0n))}.`)
}

runMain(main)
