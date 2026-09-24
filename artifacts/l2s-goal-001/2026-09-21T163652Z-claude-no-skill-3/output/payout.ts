// payout.ts: pay a CSV batch of recipients in native USDC on Celo from the ops wallet.
//
//   Dry run (default; read-only, needs only OPS_ADDRESS or OPS_PRIVATE_KEY):
//     npx tsx payout.ts batches/2026-09-cycle.csv
//
//   Execute (broadcasts; the expected total and count must match the CSV exactly):
//     npx tsx payout.ts batches/2026-09-cycle.csv --execute --expect-total 12500.00 --expect-count 42
//
// CSV columns (header row required): recipient,amount_usdc[,reference]
//   amount_usdc is a decimal USDC amount with at most 6 decimals, e.g. 125.50
//
// Safe to re-run: progress is journaled to <csv>.journal.json before every
// broadcast. Re-running the same command resumes the batch and never pays a
// confirmed row twice. See NOTES.md.

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
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
  keccak256,
  parseAbi,
  parseEventLogs,
  parseGwei,
  parseUnits,
  zeroAddress,
} from 'viem'
import { celo } from 'viem/chains'
import {
  CELO_CHAIN_ID,
  USDC_CELO,
  USDC_DECIMALS,
  die,
  env,
  loadAccount,
  optionalEnv,
  parseAddress,
  parseArgs,
  readJournal,
  writeJournal,
} from './common.ts'

const fiatTokenAbi = parseAbi([
  'function isBlacklisted(address) view returns (bool)',
  'function paused() view returns (bool)',
])

const RECEIPT_TIMEOUT_MS = 90_000
const MAX_FEE_BUMPS = 3

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Row = { index: number; line: number; recipient: Address; amount: bigint; reference: string }

type Attempt = { hash: Hash; raw: Hex; maxFeePerGas: bigint; maxPriorityFeePerGas: bigint; sentAt: string }

type JournalRow = {
  index: number
  recipient: Address
  amount: bigint
  reference: string
  status: 'pending' | 'sent' | 'confirmed' | 'failed' | 'conflict'
  nonce?: number
  attempts: Attempt[]
  previousAttempts?: Attempt[]
  txHash?: Hash
  blockNumber?: bigint
}

type Journal = {
  kind: 'celo-usdc-payout'
  csvSha256: string
  chainId: number
  token: Address
  from: Address
  createdAt: string
  rows: JournalRow[]
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Minimal RFC 4180 parser (quoted fields, escaped quotes, CRLF). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++
      else if (c === '"') inQuotes = false
      else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') row.push(field), (field = '')
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field), rows.push(row), (row = []), (field = '')
    } else field += c
  }
  if (inQuotes) die('CSV has an unterminated quoted field')
  if (field !== '' || row.length) row.push(field), rows.push(row)
  return rows
}

function loadBatch(path: string, allowDuplicateRecipients: boolean): Row[] {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '')
  const table = parseCsv(text)
  const header = table.shift()?.map((h) => h.trim().toLowerCase())
  if (!header) die('CSV is empty')
  const col = (name: string) => header.indexOf(name)
  const [ri, ai, fi] = [col('recipient'), col('amount_usdc'), col('reference')]
  if (ri < 0 || ai < 0) die(`CSV header must include "recipient" and "amount_usdc" (got: ${header.join(',')})`)

  const errors: string[] = []
  const rows: Row[] = []
  const seenRecipients = new Map<string, number>()
  const seenRefs = new Map<string, number>()

  table.forEach((cells, i) => {
    const line = i + 2
    if (cells.every((c) => c.trim() === '')) return // blank line
    const rawAddr = (cells[ri] ?? '').trim()
    const rawAmt = (cells[ai] ?? '').trim()
    const reference = fi >= 0 ? (cells[fi] ?? '').trim() : ''

    // strict: rejects mixed-case addresses whose EIP-55 checksum is wrong (typos).
    if (!isAddress(rawAddr, { strict: true })) {
      errors.push(`line ${line}: invalid recipient "${rawAddr}" (bad format or checksum)`)
      return
    }
    const recipient = getAddress(rawAddr)
    if (recipient === zeroAddress) {
      errors.push(`line ${line}: recipient is the zero address`)
      return
    }

    // Reject rather than round: parseUnits would silently round 1.2345678.
    if (!/^\d+(\.\d{1,6})?$/.test(rawAmt)) {
      errors.push(`line ${line}: amount "${rawAmt}" must be a plain decimal with at most 6 decimals`)
      return
    }
    const amount = parseUnits(rawAmt, USDC_DECIMALS)
    if (amount <= 0n) errors.push(`line ${line}: amount must be > 0`)

    const key = recipient.toLowerCase()
    if (seenRecipients.has(key) && !allowDuplicateRecipients)
      errors.push(`line ${line}: recipient ${recipient} already appears on line ${seenRecipients.get(key)} (pass --allow-duplicate-recipients if intended)`)
    seenRecipients.set(key, line)

    if (reference) {
      if (seenRefs.has(reference)) errors.push(`line ${line}: reference "${reference}" duplicates line ${seenRefs.get(reference)}`)
      seenRefs.set(reference, line)
    }

    rows.push({ index: rows.length, line, recipient, amount, reference })
  })

  if (errors.length) die(`CSV validation failed:\n  ${errors.join('\n  ')}`)
  if (!rows.length) die('CSV contains no payout rows')
  return rows
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2))
  const csvPath = positional[0]
  if (!csvPath) die('usage: payout.ts <batch.csv> [--execute --expect-total <usdc> --expect-count <n>] [--retry-failed]')
  const execute = flags.execute === true
  const journalPath = `${csvPath}.journal.json`

  const rows = loadBatch(csvPath, flags['allow-duplicate-recipients'] === true)
  const csvSha256 = createHash('sha256').update(readFileSync(csvPath)).digest('hex')
  const total = rows.reduce((s, r) => s + r.amount, 0n)

  const maxRow = optionalEnv('MAX_PAYOUT_USDC')
  if (maxRow) {
    const cap = parseUnits(maxRow, USDC_DECIMALS)
    const over = rows.filter((r) => r.amount > cap)
    if (over.length) die(`${over.length} row(s) exceed MAX_PAYOUT_USDC=${maxRow}: lines ${over.map((r) => r.line).join(', ')}`)
  }

  const account = execute || optionalEnv('OPS_PRIVATE_KEY') ? loadAccount('OPS_PRIVATE_KEY') : undefined
  const from: Address = account?.address ?? parseAddress(env('OPS_ADDRESS'), 'OPS_ADDRESS')

  const transport = http(env('CELO_RPC_URL'), { retryCount: 3 })
  const client = createPublicClient({ chain: celo, transport })

  // --- Environment checks -------------------------------------------------
  const chainId = await client.getChainId()
  if (chainId !== CELO_CHAIN_ID) die(`CELO_RPC_URL is chain ${chainId}, expected Celo mainnet ${CELO_CHAIN_ID}`)

  const [symbol, decimals, paused, senderBlacklisted] = await Promise.all([
    client.readContract({ address: USDC_CELO, abi: erc20Abi, functionName: 'symbol' }),
    client.readContract({ address: USDC_CELO, abi: erc20Abi, functionName: 'decimals' }),
    client.readContract({ address: USDC_CELO, abi: fiatTokenAbi, functionName: 'paused' }),
    client.readContract({ address: USDC_CELO, abi: fiatTokenAbi, functionName: 'isBlacklisted', args: [from] }),
  ])
  if (symbol !== 'USDC' || decimals !== USDC_DECIMALS) die(`Token at ${USDC_CELO} is ${symbol}/${decimals}, expected USDC/6`)
  if (paused) die('USDC contract is paused by Circle; no transfers possible right now')
  if (senderBlacklisted) die(`Ops wallet ${from} is blacklisted by USDC; stop and escalate`)

  // --- Recipient checks ---------------------------------------------------
  const problems: string[] = []
  const contracts: Row[] = []
  const blacklisted = await client.multicall({
    allowFailure: false,
    contracts: rows.map((r) => ({ address: USDC_CELO, abi: fiatTokenAbi, functionName: 'isBlacklisted' as const, args: [r.recipient] as const })),
  })
  for (const r of rows) {
    if (r.recipient.toLowerCase() === from.toLowerCase()) problems.push(`line ${r.line}: recipient is the ops wallet itself`)
    if (r.recipient.toLowerCase() === USDC_CELO.toLowerCase()) problems.push(`line ${r.line}: recipient is the USDC contract (funds would be lost)`)
    if (blacklisted[r.index]) problems.push(`line ${r.line}: ${r.recipient} is USDC-blacklisted; transfer would revert`)
  }
  for (const r of rows) {
    const code = await client.getCode({ address: r.recipient })
    if (code && code !== '0x') contracts.push(r)
  }
  if (problems.length) die(`Recipient checks failed:\n  ${problems.join('\n  ')}`)

  // --- Journal / resume state --------------------------------------------
  let journal = readJournal<Journal>(journalPath)
  if (journal) {
    if (journal.csvSha256 !== csvSha256)
      die(`${journalPath} belongs to a different version of this CSV. A batch file must not be edited after execution starts; put corrections in a new CSV.`)
    if (journal.from.toLowerCase() !== from.toLowerCase()) die(`Journal was written by ${journal.from}, current signer is ${from}`)
    if (flags['retry-failed'] === true && execute) {
      for (const jr of journal.rows)
        if (jr.status === 'failed' || jr.status === 'conflict') {
          jr.previousAttempts = [...(jr.previousAttempts ?? []), ...jr.attempts]
          Object.assign(jr, { status: 'pending', attempts: [], nonce: undefined, txHash: undefined })
        }
      writeJournal(journalPath, journal)
    }
  }
  const statusOf = (i: number) => journal?.rows[i]?.status ?? 'pending'
  const remaining = rows.filter((r) => statusOf(r.index) !== 'confirmed')
  const remainingTotal = remaining.reduce((s, r) => s + r.amount, 0n)

  // --- Balances -----------------------------------------------------------
  const [usdcBal, celoBal, fees] = await Promise.all([
    client.readContract({ address: USDC_CELO, abi: erc20Abi, functionName: 'balanceOf', args: [from] }),
    client.getBalance({ address: from }),
    client.estimateFeesPerGas(),
  ])
  // First-time recipient transfers cost ~60k gas on FiatToken; budget 80k each.
  const gasBudget = 80_000n * BigInt(remaining.length) * fees.maxFeePerGas

  // --- Summary ------------------------------------------------------------
  const fmtU = (v: bigint) => formatUnits(v, USDC_DECIMALS)
  console.log(`
Batch            ${csvPath}  (sha256 ${csvSha256.slice(0, 16)}...)
Network          Celo mainnet (${chainId})
Token            USDC ${USDC_CELO}
From             ${from}
Rows             ${rows.length}   total ${fmtU(total)} USDC
Remaining        ${remaining.length}   total ${fmtU(remainingTotal)} USDC${journal ? `   (resuming ${journalPath})` : ''}
Ops USDC balance ${fmtU(usdcBal)}
Ops CELO balance ${formatEther(celoBal)}   (gas budget for remaining ≈ ${formatEther(gasBudget)} CELO)`)
  if (contracts.length)
    console.log(`\nNOTE: ${contracts.length} recipient(s) are contracts (smart wallets/exchange contracts). Confirm they can receive USDC on Celo:\n  ${contracts.map((r) => `line ${r.line} ${r.recipient}`).join('\n  ')}`)
  if (journal) {
    const counts = journal.rows.reduce<Record<string, number>>((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {})
    console.log(`\nJournal status: ${JSON.stringify(counts)}`)
  }

  if (usdcBal < remainingTotal) die(`Insufficient USDC: have ${fmtU(usdcBal)}, need ${fmtU(remainingTotal)}`)
  if (celoBal < gasBudget) die(`Insufficient CELO for gas: have ${formatEther(celoBal)}, budget ${formatEther(gasBudget)}`)
  if (journal?.rows.some((r) => r.status === 'conflict'))
    die('Journal has rows in "conflict" state (nonce consumed by another transaction). Verify on the explorer that those recipients were NOT paid, then re-run with --retry-failed. See NOTES.md.')

  if (!execute) {
    console.log('\nDRY RUN: checks passed, nothing broadcast. Re-run with --execute --expect-total <usdc> --expect-count <n>.')
    return
  }

  // --- Execution guardrails ----------------------------------------------
  const expTotal = flags['expect-total']
  const expCount = flags['expect-count']
  if (typeof expTotal !== 'string' || typeof expCount !== 'string')
    die('--execute requires --expect-total and --expect-count (the figures finance approved)')
  if (parseUnits(expTotal, USDC_DECIMALS) !== total) die(`--expect-total ${expTotal} != CSV total ${fmtU(total)}`)
  if (Number(expCount) !== rows.length) die(`--expect-count ${expCount} != CSV rows ${rows.length}`)
  if (!account) die('OPS_PRIVATE_KEY required for --execute')

  if (!journal) {
    journal = {
      kind: 'celo-usdc-payout',
      csvSha256,
      chainId,
      token: USDC_CELO,
      from,
      createdAt: new Date().toISOString(),
      rows: rows.map((r) => ({ index: r.index, recipient: r.recipient, amount: r.amount, reference: r.reference, status: 'pending', attempts: [] })),
    }
    writeJournal(journalPath, journal)
  }
  const j = journal
  const save = () => writeJournal(journalPath, j)

  const wallet = createWalletClient({ account, chain: celo, transport })
  const maxFeeCap = parseGwei(optionalEnv('MAX_FEE_GWEI') ?? '1000')

  /** Poll all attempt hashes for a row; the first one mined wins (they share a nonce). */
  async function waitAny(jr: JournalRow, timeoutMs: number) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      for (const a of jr.attempts) {
        const receipt = await client.getTransactionReceipt({ hash: a.hash }).catch(() => undefined)
        if (receipt) return receipt
      }
      await new Promise((r) => setTimeout(r, 2_000))
    }
    return undefined
  }

  async function signAndSend(jr: JournalRow, nonce: number, feeMultiplierPct: bigint) {
    const data = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [jr.recipient, jr.amount] })
    const [est, f] = await Promise.all([
      client.estimateGas({ account: account!, to: USDC_CELO, data }),
      client.estimateFeesPerGas(),
    ])
    let maxFeePerGas = (f.maxFeePerGas * feeMultiplierPct) / 100n
    let maxPriorityFeePerGas = (f.maxPriorityFeePerGas * feeMultiplierPct) / 100n
    const prev = jr.attempts.at(-1)
    if (prev) {
      // Replacement must beat the previous attempt by >= 10% on both fields.
      maxFeePerGas = [maxFeePerGas, (prev.maxFeePerGas * 115n) / 100n].reduce((a, b) => (a > b ? a : b))
      maxPriorityFeePerGas = [maxPriorityFeePerGas, (prev.maxPriorityFeePerGas * 115n) / 100n].reduce((a, b) => (a > b ? a : b))
    }
    if (maxFeePerGas > maxFeeCap) die(`Required maxFeePerGas ${formatUnits(maxFeePerGas, 9)} gwei exceeds MAX_FEE_GWEI; journal saved, re-run later`)

    const raw = await wallet.signTransaction({
      account: account!,
      chain: celo,
      to: USDC_CELO,
      data,
      nonce,
      gas: (est * 125n) / 100n,
      maxFeePerGas,
      maxPriorityFeePerGas,
    })
    const hash = keccak256(raw)
    jr.status = 'sent'
    jr.nonce = nonce
    jr.attempts.push({ hash, raw, maxFeePerGas, maxPriorityFeePerGas, sentAt: new Date().toISOString() })
    save() // persisted BEFORE broadcast
    await broadcast(raw)
  }

  async function broadcast(raw: Hex) {
    try {
      await client.sendRawTransaction({ serializedTransaction: raw })
    } catch (e: any) {
      const msg = String(e?.details ?? e?.shortMessage ?? e?.message ?? e)
      // Already in mempool / already mined are fine; the receipt poll resolves it.
      if (!/already known|known transaction|nonce too low|already imported/i.test(msg)) throw e
    }
  }

  /** Drive a 'sent' row to a terminal state. Returns false if the batch must halt. */
  async function settle(jr: JournalRow): Promise<boolean> {
    for (let bump = 0; ; bump++) {
      const receipt = await waitAny(jr, RECEIPT_TIMEOUT_MS)
      if (receipt) {
        const ok =
          receipt.status === 'success' &&
          parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: receipt.logs }).some(
            (l) =>
              l.address.toLowerCase() === USDC_CELO.toLowerCase() &&
              l.args.from.toLowerCase() === from.toLowerCase() &&
              l.args.to.toLowerCase() === jr.recipient.toLowerCase() &&
              l.args.value === jr.amount,
          )
        jr.status = ok ? 'confirmed' : 'failed'
        jr.txHash = receipt.transactionHash
        jr.blockNumber = receipt.blockNumber
        save()
        const r = rows[jr.index]!
        console.log(`${ok ? 'PAID  ' : 'FAILED'} line ${r.line} ${jr.recipient} ${fmtU(jr.amount)} USDC  ${celo.blockExplorers.default.url}/tx/${receipt.transactionHash}`)
        return ok
      }
      // No receipt. Has our nonce been consumed by something else?
      const latest = await client.getTransactionCount({ address: from, blockTag: 'latest' })
      if (latest > jr.nonce!) {
        await new Promise((r) => setTimeout(r, 10_000))
        if (await waitAny(jr, 5_000)) continue
        jr.status = 'conflict'
        save()
        console.error(`CONFLICT line ${rows[jr.index]!.line}: nonce ${jr.nonce} was used by a transaction not in this journal. Halting.`)
        return false
      }
      if (bump >= MAX_FEE_BUMPS) {
        console.error(`Row ${jr.index} still unmined after ${MAX_FEE_BUMPS} fee bumps. Journal saved; re-run to resume.`)
        return false
      }
      console.log(`  not mined after ${RECEIPT_TIMEOUT_MS / 1000}s; replacing with higher fee (same nonce)`)
      await signAndSend(jr, jr.nonce!, 150n)
    }
  }

  // Finish anything that was in flight when a previous run stopped.
  for (const jr of j.rows.filter((r) => r.status === 'sent')) {
    console.log(`Resuming in-flight row ${jr.index} (nonce ${jr.nonce})`)
    await broadcast(jr.attempts.at(-1)!.raw)
    if (!(await settle(jr))) process.exit(2)
  }
  if (j.rows.some((r) => r.status === 'failed')) die('Batch has failed rows. Investigate, then re-run with --retry-failed.')

  for (const jr of j.rows.filter((r) => r.status === 'pending')) {
    const [latest, pending] = await Promise.all([
      client.getTransactionCount({ address: from, blockTag: 'latest' }),
      client.getTransactionCount({ address: from, blockTag: 'pending' }),
    ])
    if (pending !== latest) die(`Ops wallet has ${pending - latest} pending tx(s) not from this batch. Do not run other jobs (e.g. sweep.ts) concurrently.`)
    await signAndSend(jr, latest, 120n)
    if (!(await settle(jr))) process.exit(2)
  }

  // --- Report -------------------------------------------------------------
  const reportPath = `${csvPath}.report.csv`
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  writeFileSync(
    reportPath,
    ['line,recipient,amount_usdc,reference,status,tx_hash,block']
      .concat(j.rows.map((r) => [rows[r.index]!.line, r.recipient, fmtU(r.amount), esc(r.reference), r.status, r.txHash ?? '', r.blockNumber ?? ''].join(',')))
      .join('\n') + '\n',
  )
  const paid = j.rows.filter((r) => r.status === 'confirmed')
  console.log(`\nDone: ${paid.length}/${j.rows.length} rows paid, ${fmtU(paid.reduce((s, r) => s + r.amount, 0n))} USDC. Report: ${reportPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
