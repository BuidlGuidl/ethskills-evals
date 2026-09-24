// Pay USDC to a list of recipients on Celo from the ops wallet.
//
//   npx tsx payout.ts <payouts.csv>                                   # dry run (default)
//   npx tsx payout.ts <payouts.csv> --execute --expect-total 1234.56  # sends
//
// CSV columns (header required, any order):  payout_id,address,amount_usdc
// See NOTES.md before running against real money.

import { readFileSync } from 'node:fs'
import {
  type Address,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  formatEther,
  formatUnits,
  http,
  parseUnits,
} from 'viem'
import { celo } from 'viem/chains'
import {
  assertChainId,
  assertNoPendingTxs,
  broadcastAndWait,
  CELO_USDC,
  die,
  env,
  flag,
  Journal,
  main,
  option,
  optionalEnv,
  parseAddress,
  privateKeyAccount,
  resolveSent,
  type SentTx,
  signAndRecord,
  USDC_DECIMALS,
} from './common.ts'

type Row = { line: number; payoutId: string; to: Address; amount: bigint }

type PayoutRecord = {
  payoutId: string
  to: Address
  amount: string // USDC base units (6 decimals)
  sourceCsv: string
  tx?: SentTx
}

type PayoutJournal = { version: 1; payouts: Record<string, PayoutRecord> }

const EXPLORER = 'https://celoscan.io/tx/'

const usdc = (v: bigint) => formatUnits(v, USDC_DECIMALS)

function parseUsdc(raw: string, where: string): bigint {
  const s = raw.trim()
  // Plain decimal only: no thousands separators, no sign, no exponent, <= 6 dp.
  if (!/^\d+(\.\d{1,6})?$/.test(s)) die(`${where}: amount "${raw}" must be a plain decimal like 125.50 (max 6 decimals, no commas)`)
  return parseUnits(s, USDC_DECIMALS)
}

function readCsv(path: string, maxPerRow: bigint, ops: Address): Row[] {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '')
  const lines = text.split(/\r?\n/)
  const header = lines[0]?.split(',').map((h) => h.trim().toLowerCase())
  if (!header) die(`${path} is empty`)
  const col = (name: string) => {
    const i = header.indexOf(name)
    if (i === -1) die(`${path}: header must include "${name}" (got: ${lines[0]})`)
    return i
  }
  const [iId, iAddr, iAmt] = [col('payout_id'), col('address'), col('amount_usdc')]

  const rows: Row[] = []
  const seenIds = new Set<string>()
  const seenAddrs = new Map<Address, number>()
  for (let n = 1; n < lines.length; n++) {
    const line = lines[n]
    if (!line.trim()) continue
    const where = `${path}:${n + 1}`
    if (line.includes('"')) die(`${where}: quoted fields are not supported; export plain CSV`)
    const cells = line.split(',')
    if (cells.length !== header.length) die(`${where}: expected ${header.length} columns, got ${cells.length}`)

    const payoutId = cells[iId].trim()
    if (!payoutId) die(`${where}: empty payout_id`)
    if (seenIds.has(payoutId)) die(`${where}: duplicate payout_id "${payoutId}"`)
    seenIds.add(payoutId)

    const to = parseAddress(cells[iAddr], where)
    if (to === '0x0000000000000000000000000000000000000000') die(`${where}: zero address`)
    if (to === CELO_USDC) die(`${where}: recipient is the USDC contract itself`)
    if (to === ops) die(`${where}: recipient is the ops wallet itself`)

    const amount = parseUsdc(cells[iAmt], where)
    if (amount === 0n) die(`${where}: amount is zero`)
    if (amount > maxPerRow) die(`${where}: ${usdc(amount)} USDC exceeds MAX_PAYOUT_USDC=${usdc(maxPerRow)}`)

    if (seenAddrs.has(to)) console.warn(`WARNING ${where}: ${to} also appears on line ${seenAddrs.get(to)} — confirm this is intended`)
    seenAddrs.set(to, n + 1)
    rows.push({ line: n + 1, payoutId, to, amount })
  }
  if (rows.length === 0) die(`${path} has no payout rows`)
  return rows
}

main(async () => {
  const csvPath = process.argv[2]
  if (!csvPath || csvPath.startsWith('--')) die('usage: npx tsx payout.ts <payouts.csv> [--execute --expect-total <usdc>]')
  const execute = flag('--execute')

  const account = privateKeyAccount('OPS_PRIVATE_KEY')
  const maxPerRow = parseUsdc(env('MAX_PAYOUT_USDC'), 'MAX_PAYOUT_USDC')
  const rows = readCsv(csvPath, maxPerRow, account.address)

  const transport = http(env('CELO_RPC_URL'), { retryCount: 5 })
  const client = createPublicClient({ chain: celo, transport })
  const wallet = createWalletClient({ account, chain: celo, transport })
  await assertChainId(client, celo.id, 'CELO_RPC_URL')

  const journal = new Journal<PayoutJournal>(optionalEnv('PAYOUT_JOURNAL') ?? 'payouts.journal.json', {
    version: 1,
    payouts: {},
  })

  // --- Reconcile CSV against the journal --------------------------------------
  for (const r of rows) {
    const prev = journal.data.payouts[r.payoutId]
    if (prev && (prev.to !== r.to || BigInt(prev.amount) !== r.amount)) {
      die(
        `payout_id "${r.payoutId}" (line ${r.line}) was previously journaled as ${usdc(BigInt(prev.amount))} USDC → ${prev.to} ` +
          `(from ${prev.sourceCsv}) but this CSV says ${usdc(r.amount)} USDC → ${r.to}. IDs must never be reused or edited.`,
      )
    }
  }

  // Finish anything a previous run signed but didn't see confirmed.
  for (const rec of Object.values(journal.data.payouts)) {
    if (rec.tx?.status !== 'signed') continue
    if (!execute) {
      console.log(`NOTE: ${rec.payoutId} has an unconfirmed tx ${rec.tx.hash} from a previous run; --execute will reconcile it first.`)
      continue
    }
    console.log(`Reconciling ${rec.payoutId} (${rec.tx.hash}) from a previous run...`)
    rec.tx = await resolveSent(client, account.address, rec.tx)
    journal.save()
  }

  const blocked = Object.values(journal.data.payouts).filter(
    (p) => p.tx?.status === 'reverted' || p.tx?.status === 'nonce-conflict',
  )
  if (blocked.length) {
    die(
      `Journal has payouts needing manual review:\n` +
        blocked.map((p) => `  ${p.payoutId}: ${p.tx!.status} ${EXPLORER}${p.tx!.hash}`).join('\n') +
        `\nSee NOTES.md "Failed or conflicting payouts".`,
    )
  }

  const done = rows.filter((r) => journal.data.payouts[r.payoutId]?.tx?.status === 'confirmed')
  const todo = rows.filter((r) => journal.data.payouts[r.payoutId]?.tx?.status !== 'confirmed')
  const todoTotal = todo.reduce((s, r) => s + r.amount, 0n)
  const csvTotal = rows.reduce((s, r) => s + r.amount, 0n)

  // --- Preflight: balances + simulate every transfer -----------------------------
  const [usdcBal, celoBal, fees] = await Promise.all([
    client.readContract({ address: CELO_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
    client.getBalance({ address: account.address }),
    client.estimateFeesPerGas(),
  ])

  console.log(`Ops wallet:        ${account.address}`)
  console.log(`CSV:               ${csvPath}  (${rows.length} rows, ${usdc(csvTotal)} USDC)`)
  console.log(`Already paid:      ${done.length} rows`)
  console.log(`To pay now:        ${todo.length} rows, ${usdc(todoTotal)} USDC`)
  console.log(`USDC balance:      ${usdc(usdcBal)}`)
  console.log(`CELO balance:      ${formatEther(celoBal)} (gas)`)

  if (todo.length === 0) {
    console.log('\nNothing to do — every row in this CSV is already confirmed on-chain.')
    return
  }
  if (usdcBal < todoTotal) die(`Insufficient USDC: need ${usdc(todoTotal)}, have ${usdc(usdcBal)}`)

  let gasEach = 0n
  for (const r of todo) {
    try {
      await client.simulateContract({
        account,
        address: CELO_USDC,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [r.to, r.amount],
      })
    } catch (e) {
      die(`Line ${r.line} (${r.payoutId} → ${r.to}): transfer would fail: ${(e as Error).message.split('\n')[0]} (blocklisted recipient?)`)
    }
    if (gasEach === 0n) {
      gasEach = await client.estimateContractGas({
        account,
        address: CELO_USDC,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [r.to, r.amount],
      })
    }
  }
  const gasBudget = ((gasEach * 3n) / 2n) * BigInt(todo.length) * fees.maxFeePerGas!
  console.log(`Est. max gas cost: ${formatEther(gasBudget)} CELO`)
  if (celoBal < gasBudget) die(`Insufficient CELO for gas: need ~${formatEther(gasBudget)}, have ${formatEther(celoBal)}`)
  console.log('All transfers simulate OK.')

  if (!execute) {
    console.log('\nDRY RUN — nothing sent. Re-run with --execute --expect-total <USDC total of rows to pay now>.')
    return
  }

  // Finance sign-off guard: operator must type the approved total.
  const expected = option('--expect-total')
  if (!expected) die('--execute requires --expect-total <usdc> matching the approved batch total')
  if (parseUsdc(expected, '--expect-total') !== todoTotal) {
    die(`--expect-total ${expected} does not match the ${usdc(todoTotal)} USDC about to be sent`)
  }

  // --- Send, one at a time, each confirmed before the next ------------------------
  let nonce = await assertNoPendingTxs(client, account.address)
  for (const [i, r] of todo.entries()) {
    const rec: PayoutRecord = (journal.data.payouts[r.payoutId] ??= {
      payoutId: r.payoutId,
      to: r.to,
      amount: r.amount.toString(),
      sourceCsv: csvPath,
    })
    const request = await wallet.prepareTransactionRequest({
      account,
      chain: celo,
      to: CELO_USDC,
      data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [r.to, r.amount] }),
      nonce,
    })
    const signed = await signAndRecord(wallet, request, (tx) => {
      rec.tx = tx
      journal.save()
    })
    const result = await broadcastAndWait(client, signed)
    rec.tx = result
    journal.save()

    const tag = `[${i + 1}/${todo.length}] ${r.payoutId} ${usdc(r.amount)} USDC → ${r.to}`
    if (result.status !== 'confirmed') die(`${tag} ${result.status.toUpperCase()}: ${EXPLORER}${result.hash}. Batch halted.`)
    console.log(`${tag}  ${EXPLORER}${result.hash}`)
    nonce++
  }
  console.log(`\nDone. Paid ${todo.length} rows, ${usdc(todoTotal)} USDC. Journal: ${journal.path}`)
})
