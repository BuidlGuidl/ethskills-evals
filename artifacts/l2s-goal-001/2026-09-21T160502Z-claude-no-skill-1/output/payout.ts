// payout.ts — pay a CSV of recipients in native USDC on Celo from the ops wallet.
//
//   Dry run (default, needs no key):
//     npx tsx payout.ts payouts.csv
//   Broadcast:
//     npx tsx payout.ts payouts.csv --execute --expect-count 42 --expect-total 12345.67
//
// CSV format (header required, exactly these columns):
//     id,address,amount_usdc
//     inv-2026-09-001,0xAbC...,125.50
//
// `id` is the idempotency key: each id is paid at most once. Progress is written
// to <csv>.journal.jsonl *before* each transaction is broadcast, so a crash or
// Ctrl-C at any point can be re-run safely with the same command.
// See NOTES.md before running against real money.

import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import {
  type Address,
  type Hex,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  formatEther,
  formatUnits,
  http,
  keccak256,
} from 'viem'
import {
  CELO_CHAIN_ID,
  CELO_USDC,
  USDC_DECIMALS,
  assertChainId,
  celo,
  celoPublicClient,
  celoRpcUrl,
  confirmPrompt,
  die,
  findReceipt,
  flag,
  loadOpsAccount,
  option,
  optionalEnv,
  parseAddress,
  parseDecimal,
  positionals,
  warn,
} from './common.js'

type Row = { line: number; id: string; to: Address; amount: bigint }

type JournalEntry =
  | { type: 'header'; csvSha256: string; ops: Address; chainId: number; token: Address; at: string }
  | { type: 'signed'; id: string; to: Address; amount: string; nonce: number; txHash: Hex; rawTx: Hex; at: string }
  | { type: 'confirmed'; id: string; txHash: Hex; blockNumber: string; status: 'success' | 'reverted'; at: string }

const RECEIPT_TIMEOUT_MS = 180_000

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function parseCsv(path: string): { rows: Row[]; sha256: string } {
  if (!existsSync(path)) die(`CSV not found: ${path}`)
  const bytes = readFileSync(path)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const lines = bytes.toString('utf8').replace(/^﻿/, '').split(/\r?\n/)

  const header = lines[0]?.trim().toLowerCase()
  if (header !== 'id,address,amount_usdc')
    die(`CSV header must be exactly "id,address,amount_usdc", got "${lines[0]}".`)

  const rows: Row[] = []
  const ids = new Set<string>()
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i]!.trim()
    if (raw === '') continue
    const lineNo = i + 1
    if (raw.includes('"')) die(`line ${lineNo}: quoted fields are not supported; export plain CSV.`)
    const cols = raw.split(',').map((c) => c.trim())
    if (cols.length !== 3) die(`line ${lineNo}: expected 3 columns, got ${cols.length}.`)
    const [id, addr, amt] = cols as [string, string, string]
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(id)) die(`line ${lineNo}: id "${id}" must be 1-128 chars of [A-Za-z0-9._:-].`)
    if (ids.has(id)) die(`line ${lineNo}: duplicate id "${id}".`)
    ids.add(id)
    const to = parseAddress(addr, `line ${lineNo} address`)
    const amount = parseDecimal(amt, USDC_DECIMALS, `line ${lineNo} amount_usdc`)
    if (amount === 0n) die(`line ${lineNo}: amount is zero.`)
    rows.push({ line: lineNo, id, to, amount })
  }
  if (rows.length === 0) die('CSV has no payout rows.')
  return { rows, sha256 }
}

// ---------------------------------------------------------------------------
// Journal (append-only JSONL next to the CSV)
// ---------------------------------------------------------------------------

function readJournal(path: string): JournalEntry[] {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l, i) => {
      try {
        return JSON.parse(l) as JournalEntry
      } catch {
        die(`${path} line ${i + 1} is corrupt. Do not delete the journal; reconcile it by hand against the explorer.`)
      }
    })
}

function appendJournal(path: string, entry: JournalEntry) {
  // appendFileSync is synchronous; the entry is on disk before we broadcast.
  appendFileSync(path, `${JSON.stringify(entry)}\n`, { flag: 'a' })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const valueOpts = ['--expect-total', '--expect-count', '--confirm']
  const [csvPath] = positionals(args, valueOpts)
  if (!csvPath) die('usage: npx tsx payout.ts <payouts.csv> [--execute --expect-count N --expect-total USDC]')

  const execute = flag(args, '--execute')
  const allowDupAddresses = flag(args, '--allow-duplicate-addresses')
  const expectTotal = option(args, '--expect-total')
  const expectCount = option(args, '--expect-count')
  if (execute && (!expectTotal || !expectCount))
    die('--execute requires --expect-count and --expect-total (the control totals from finance, typed independently of the CSV).')

  const { rows, sha256 } = parseCsv(csvPath)
  const journalPath = `${csvPath}.journal.jsonl`

  // ---- Static checks on the batch ----------------------------------------
  const total = rows.reduce((s, r) => s + r.amount, 0n)
  if (expectCount && Number(expectCount) !== rows.length)
    die(`--expect-count ${expectCount} but CSV has ${rows.length} rows.`)
  if (expectTotal && parseDecimal(expectTotal, USDC_DECIMALS, '--expect-total') !== total)
    die(`--expect-total ${expectTotal} but CSV sums to ${formatUnits(total, USDC_DECIMALS)} USDC.`)

  const maxRow = optionalEnv('PAYOUT_MAX_ROW_USDC')
  if (maxRow) {
    const cap = parseDecimal(maxRow, USDC_DECIMALS, 'PAYOUT_MAX_ROW_USDC')
    const over = rows.filter((r) => r.amount > cap)
    if (over.length) die(`${over.length} row(s) exceed PAYOUT_MAX_ROW_USDC=${maxRow}, first is line ${over[0]!.line}.`)
  }

  const { address: ops, account } = loadOpsAccount(execute)

  const byAddr = new Map<Address, Row[]>()
  for (const r of rows) byAddr.set(r.to, [...(byAddr.get(r.to) ?? []), r])
  const dups = [...byAddr.values()].filter((v) => v.length > 1)
  if (dups.length) {
    for (const d of dups) warn(`address ${d[0]!.to} appears on lines ${d.map((r) => r.line).join(', ')}`)
    if (!allowDupAddresses) die('Same address appears more than once. If intended, re-run with --allow-duplicate-addresses.')
  }
  for (const r of rows) {
    if (r.to === ops) die(`line ${r.line}: recipient is the ops wallet itself.`)
    if (r.to === CELO_USDC) die(`line ${r.line}: recipient is the USDC token contract; funds would be lost.`)
  }

  // ---- On-chain checks ---------------------------------------------------
  const client = celoPublicClient()
  await assertChainId(client, CELO_CHAIN_ID, 'CELO_RPC_URL')

  const [symbol, decimals] = await Promise.all([
    client.readContract({ address: CELO_USDC, abi: erc20Abi, functionName: 'symbol' }),
    client.readContract({ address: CELO_USDC, abi: erc20Abi, functionName: 'decimals' }),
  ])
  if (symbol !== 'USDC' || decimals !== USDC_DECIMALS)
    die(`Token at ${CELO_USDC} reports ${symbol}/${decimals}, expected USDC/${USDC_DECIMALS}.`)

  // ---- Reconcile journal from any previous run ---------------------------
  const journal = readJournal(journalPath)
  const head = journal[0]
  if (head) {
    if (head.type !== 'header') die(`${journalPath} has no header line; reconcile by hand.`)
    if (head.csvSha256 !== sha256)
      die(`${journalPath} belongs to a different version of this CSV (sha256 mismatch). Someone edited the CSV mid-batch. Do NOT delete the journal; build a new CSV containing only the unpaid rows.`)
    if (head.ops !== ops) die(`${journalPath} was written for ops wallet ${head.ops}, not ${ops}.`)
  }

  const paid = new Map<string, Hex>()
  const inFlight = new Map<string, Extract<JournalEntry, { type: 'signed' }>>()
  for (const e of journal) {
    if (e.type === 'signed') inFlight.set(e.id, e)
    if (e.type === 'confirmed') {
      inFlight.delete(e.id)
      if (e.status === 'success') paid.set(e.id, e.txHash)
      else die(`id ${e.id} has a REVERTED tx ${e.txHash} in the journal. Investigate before continuing.`)
    }
  }

  // Anything signed-but-unconfirmed from a previous run: find out what happened.
  for (const s of inFlight.values()) {
    const receipt = await findReceipt(client, s.txHash)
    if (receipt) {
      console.log(`recovered: ${s.id} ${s.txHash} → ${receipt.status} in block ${receipt.blockNumber}`)
      if (execute)
        appendJournal(journalPath, {
          type: 'confirmed',
          id: s.id,
          txHash: s.txHash,
          blockNumber: receipt.blockNumber.toString(),
          status: receipt.status,
          at: new Date().toISOString(),
        })
      if (receipt.status !== 'success') die(`id ${s.id} reverted on-chain (${s.txHash}). Investigate before continuing.`)
      paid.set(s.id, s.txHash)
      inFlight.delete(s.id)
      continue
    }
    const latestNonce = await client.getTransactionCount({ address: ops, blockTag: 'latest' })
    if (latestNonce > s.nonce)
      die(
        `id ${s.id}: tx ${s.txHash} (nonce ${s.nonce}) has no receipt but the ops nonce is already ${latestNonce}. ` +
          'It was replaced or dropped. Confirm on the explorer that the recipient was NOT paid, then add a ' +
          `{"type":"confirmed",...,"status":"reverted"} note by hand or move this id to a fresh CSV.`,
      )
    // Not mined, nonce not consumed: rebroadcasting the identical signed tx is idempotent.
    console.log(`in-flight: ${s.id} ${s.txHash} (nonce ${s.nonce}) not mined yet; will rebroadcast the same signed tx.`)
  }

  const todo = rows.filter((r) => !paid.has(r.id))
  const todoTotal = todo.reduce((s, r) => s + r.amount, 0n)

  const [usdcBal, celoBal, pendingNonce, latestNonce, gasPrice] = await Promise.all([
    client.readContract({ address: CELO_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [ops] }),
    client.getBalance({ address: ops }),
    client.getTransactionCount({ address: ops, blockTag: 'pending' }),
    client.getTransactionCount({ address: ops, blockTag: 'latest' }),
    client.getGasPrice(),
  ])

  console.log(`\nChain:        Celo (${CELO_CHAIN_ID}) via ${celoRpcUrl()}`)
  console.log(`Ops wallet:   ${ops}`)
  console.log(`Token:        USDC ${CELO_USDC}`)
  console.log(`CSV:          ${csvPath} (sha256 ${sha256.slice(0, 16)}…)`)
  console.log(`Rows:         ${rows.length} total, ${paid.size} already paid, ${todo.length} to pay`)
  console.log(`Batch total:  ${formatUnits(total, USDC_DECIMALS)} USDC`)
  console.log(`To send now:  ${formatUnits(todoTotal, USDC_DECIMALS)} USDC`)
  console.log(`USDC balance: ${formatUnits(usdcBal, USDC_DECIMALS)}`)
  console.log(`CELO balance: ${formatEther(celoBal)} (gas)`)

  if (todo.length === 0) {
    console.log('\nNothing to do: every row in this CSV is already paid.')
    return
  }
  if (usdcBal < todoTotal)
    die(`Insufficient USDC: need ${formatUnits(todoTotal, USDC_DECIMALS)}, have ${formatUnits(usdcBal, USDC_DECIMALS)}.`)
  if (inFlight.size === 0 && pendingNonce !== latestNonce)
    die(`Ops wallet has ${pendingNonce - latestNonce} pending tx(s) not from this batch. Wait for them to clear first.`)

  // Simulate every transfer from the ops wallet. Catches Circle-blacklisted
  // recipients/sender, a paused token, and anything else that would revert.
  console.log(`\nSimulating ${todo.length} transfer(s)…`)
  let maxGas = 0n
  for (const r of todo) {
    try {
      // estimateGas executes the call and throws if it would revert.
      const g = await client.estimateContractGas({
        account: ops,
        address: CELO_USDC,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [r.to, r.amount],
      })
      if (g > maxGas) maxGas = g
    } catch (e) {
      die(`line ${r.line} (${r.id} → ${r.to}): transfer would revert: ${(e as Error).message.split('\n')[0]}`)
    }
  }
  // Transfers to a fresh address cost more (new storage slot) — budget with headroom.
  const gasPerTx = (maxGas * 13n) / 10n
  const gasBudget = gasPerTx * gasPrice * 2n * BigInt(todo.length)
  console.log(`Gas budget:   ~${formatEther(gasBudget)} CELO (2× current price, ${gasPerTx} gas/tx)`)
  if (celoBal < gasBudget) die(`Not enough CELO for gas: need ~${formatEther(gasBudget)}, have ${formatEther(celoBal)}.`)

  if (!execute) {
    console.log('\nDRY RUN OK. First rows:')
    for (const r of todo.slice(0, 10)) console.log(`  ${r.id.padEnd(24)} ${r.to} ${formatUnits(r.amount, USDC_DECIMALS)}`)
    if (todo.length > 10) console.log(`  … and ${todo.length - 10} more`)
    console.log(
      `\nTo broadcast: npx tsx payout.ts ${csvPath} --execute --expect-count ${rows.length} --expect-total ${formatUnits(total, USDC_DECIMALS)}`,
    )
    return
  }

  // ---- Broadcast ---------------------------------------------------------
  await confirmPrompt(`PAY ${todo.length} ${formatUnits(todoTotal, USDC_DECIMALS)}`)

  if (!head)
    appendJournal(journalPath, {
      type: 'header',
      csvSha256: sha256,
      ops,
      chainId: CELO_CHAIN_ID,
      token: CELO_USDC,
      at: new Date().toISOString(),
    })

  const wallet = createWalletClient({ account: account!, chain: celo, transport: http(celoRpcUrl()) })

  const waitAndRecord = async (id: string, hash: Hex) => {
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: RECEIPT_TIMEOUT_MS })
    appendJournal(journalPath, {
      type: 'confirmed',
      id,
      txHash: hash,
      blockNumber: receipt.blockNumber.toString(),
      status: receipt.status,
      at: new Date().toISOString(),
    })
    if (receipt.status !== 'success') die(`id ${id}: tx ${hash} REVERTED. Stopping; remaining rows untouched.`)
    return receipt
  }

  // 1) Finish anything left in flight from a crashed run (same signed bytes, same hash).
  for (const s of inFlight.values()) {
    await client.sendRawTransaction({ serializedTransaction: s.rawTx }).catch((e: Error) => {
      // "already known" / "nonce too low" just mean it's already in the pool or mined.
      warn(`rebroadcast of ${s.txHash}: ${e.message.split('\n')[0]}`)
    })
    const rc = await waitAndRecord(s.id, s.txHash)
    console.log(`✓ ${s.id} (recovered) ${s.txHash} block ${rc.blockNumber}`)
  }

  // 2) Pay the rest, strictly one at a time, stopping on the first problem.
  const remaining = todo.filter((r) => !inFlight.has(r.id))
  let nonce = await client.getTransactionCount({ address: ops, blockTag: 'pending' })
  let done = 0
  for (const r of remaining) {
    const request = await wallet.prepareTransactionRequest({
      to: CELO_USDC,
      data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [r.to, r.amount] }),
      value: 0n,
      nonce,
      gas: gasPerTx,
    })
    const rawTx = await wallet.signTransaction(request)
    const txHash = keccak256(rawTx)

    // Journal first, broadcast second: a crash after this line is recoverable.
    appendJournal(journalPath, {
      type: 'signed',
      id: r.id,
      to: r.to,
      amount: r.amount.toString(),
      nonce,
      txHash,
      rawTx,
      at: new Date().toISOString(),
    })
    await client.sendRawTransaction({ serializedTransaction: rawTx })
    const rc = await waitAndRecord(r.id, txHash)
    done++
    console.log(
      `✓ [${done}/${remaining.length}] ${r.id} ${r.to} ${formatUnits(r.amount, USDC_DECIMALS)} USDC  ${txHash} block ${rc.blockNumber}`,
    )
    nonce++
  }

  console.log(`\nDone. ${rows.length} rows paid in total; journal: ${journalPath}`)
}

main().catch((e) => die((e as Error).stack ?? String(e)))
