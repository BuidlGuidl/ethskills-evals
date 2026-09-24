// Pay USDC on Celo to every recipient in a CSV, from the ops wallet.
//
//   npx tsx payout.ts --csv recipients.csv            # dry run: validate + simulate every transfer
//   npx tsx payout.ts --csv recipients.csv --send     # broadcast
//
// CSV format (header required, amounts in whole USDC, max 6 decimals, no quoting):
//   address,amount
//   0xAbC...123,125.50
//
// Crash safety: every transfer is signed, its hash written to a journal
// (payout-journal/<sha256 of csv>.jsonl), and only then broadcast. Re-running the
// same CSV skips rows that were already paid and never re-signs a row that has a
// recorded hash, so a crash or Ctrl-C mid-run can't double-pay.

import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import {
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
  parseUnits,
  zeroAddress,
  type Address,
  type Hash,
} from 'viem'
import {
  CELO_USDC,
  CELO_USDC_DECIMALS,
  celo,
  die,
  opsAccountOrAddress,
  requireEnv,
  sameAddress,
} from './common.ts'

const { values: args } = parseArgs({
  options: {
    csv: { type: 'string' },
    send: { type: 'boolean', default: false },
    'allow-duplicate-recipients': { type: 'boolean', default: false },
  },
})
if (!args.csv) die('Usage: payout.ts --csv <file> [--send]')
const SEND = args.send!

// Hard caps. Required so a fat-fingered CSV (e.g. amounts in cents) can't drain the wallet.
const MAX_PER_RECIPIENT = parseUnits(requireEnv('PAYOUT_MAX_PER_RECIPIENT_USDC'), CELO_USDC_DECIMALS)
const MAX_TOTAL = parseUnits(requireEnv('PAYOUT_MAX_TOTAL_USDC'), CELO_USDC_DECIMALS)

const publicClient = createPublicClient({ chain: celo, transport: http(requireEnv('CELO_RPC_URL')) })
const account = opsAccountOrAddress(SEND)
const opsAddress: Address = typeof account === 'string' ? account : account.address

// ---- 1. Parse + validate the CSV ----------------------------------------------------

type Row = { line: number; to: Address; amount: bigint }

const csvText = readFileSync(args.csv, 'utf8')
const csvHash = createHash('sha256').update(csvText).digest('hex')
const rows: Row[] = []
const errors: string[] = []
const lines = csvText.split(/\r?\n/)

const header = lines[0]?.replace(/^﻿/, '').trim().toLowerCase()
if (header !== 'address,amount') die(`CSV header must be exactly "address,amount", got "${lines[0]}"`)

for (let i = 1; i < lines.length; i++) {
  const raw = lines[i].trim()
  if (!raw || raw.startsWith('#')) continue
  const line = i + 1
  const cols = raw.split(',').map((c) => c.trim())
  if (cols.length !== 2) { errors.push(`line ${line}: expected 2 columns, got ${cols.length}`); continue }
  const [addr, amt] = cols

  // strict: mixed-case addresses must have a valid EIP-55 checksum (catches typos).
  if (!isAddress(addr, { strict: true })) { errors.push(`line ${line}: invalid address "${addr}"`); continue }
  const to = getAddress(addr)
  if (to === zeroAddress) { errors.push(`line ${line}: zero address`); continue }
  if (sameAddress(to, CELO_USDC)) { errors.push(`line ${line}: recipient is the USDC contract`); continue }
  if (sameAddress(to, opsAddress)) { errors.push(`line ${line}: recipient is the ops wallet itself`); continue }

  if (!/^\d+(\.\d{1,6})?$/.test(amt)) { errors.push(`line ${line}: bad amount "${amt}" (plain decimal, max 6 dp)`); continue }
  const amount = parseUnits(amt, CELO_USDC_DECIMALS)
  if (amount === 0n) { errors.push(`line ${line}: amount is zero`); continue }
  if (amount > MAX_PER_RECIPIENT) { errors.push(`line ${line}: ${amt} USDC exceeds PAYOUT_MAX_PER_RECIPIENT_USDC`); continue }

  rows.push({ line, to, amount })
}

if (!args['allow-duplicate-recipients']) {
  const seen = new Map<string, number>()
  for (const r of rows) {
    const prev = seen.get(r.to)
    if (prev) errors.push(`line ${r.line}: ${r.to} already appears on line ${prev} (use --allow-duplicate-recipients if intended)`)
    else seen.set(r.to, r.line)
  }
}

if (errors.length) die(`CSV rejected, nothing was sent:\n  ${errors.join('\n  ')}`)
if (!rows.length) die('CSV has no payout rows.')

const total = rows.reduce((s, r) => s + r.amount, 0n)
if (total > MAX_TOTAL) die(`CSV total ${formatUnits(total, 6)} USDC exceeds PAYOUT_MAX_TOTAL_USDC`)

// ---- 2. Journal (crash-safe resume) ----------------------------------------------------

type JournalEntry = { line: number; to: Address; amount: string; hash: Hash; nonce: number }
const journalDir = 'payout-journal'
const journalPath = `${journalDir}/${csvHash}.jsonl`
mkdirSync(journalDir, { recursive: true })
const journal = new Map<number, JournalEntry>()
if (existsSync(journalPath)) {
  for (const l of readFileSync(journalPath, 'utf8').split('\n').filter(Boolean)) {
    const e = JSON.parse(l) as JournalEntry
    journal.set(e.line, e)
  }
}

// ---- 3. Pre-flight against the chain -----------------------------------------------

const chainId = await publicClient.getChainId()
if (chainId !== celo.id) die(`CELO_RPC_URL is chain ${chainId}, expected Celo mainnet (${celo.id})`)

const [symbol, decimals, usdcBalance, celoBalance, nonceLatest, noncePending] = await Promise.all([
  publicClient.readContract({ address: CELO_USDC, abi: erc20Abi, functionName: 'symbol' }),
  publicClient.readContract({ address: CELO_USDC, abi: erc20Abi, functionName: 'decimals' }),
  publicClient.readContract({ address: CELO_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [opsAddress] }),
  publicClient.getBalance({ address: opsAddress }),
  publicClient.getTransactionCount({ address: opsAddress, blockTag: 'latest' }),
  publicClient.getTransactionCount({ address: opsAddress, blockTag: 'pending' }),
])
if (symbol !== 'USDC' || decimals !== CELO_USDC_DECIMALS) die(`Token at ${CELO_USDC} is ${symbol}/${decimals}, expected USDC/6`)

// Resolve rows already in the journal before deciding what's left to pay.
const paid = new Set<number>()
for (const [line, e] of journal) {
  const receipt = await publicClient.getTransactionReceipt({ hash: e.hash }).catch(() => null)
  if (receipt?.status === 'success') { paid.add(line); continue }
  if (receipt?.status === 'reverted') die(`line ${line}: tx ${e.hash} REVERTED on-chain. Investigate before re-running; remove that journal line only once you're sure it should be retried.`)
  // Signed but no receipt: it may still be pending, or was never broadcast (crash between
  // journal write and send). Either way a human decides — never auto-resign.
  die(`line ${line}: journaled tx ${e.hash} (nonce ${e.nonce}) has no receipt. If it's pending, wait and re-run. ` +
    `If it was never broadcast (ops nonce is still <= ${e.nonce}), delete that line from ${journalPath} and re-run.`)
}

const todo = rows.filter((r) => !paid.has(r.line))
const todoTotal = todo.reduce((s, r) => s + r.amount, 0n)

console.log(`Ops wallet      ${opsAddress}`)
console.log(`CSV             ${args.csv} (sha256 ${csvHash.slice(0, 16)}…)`)
console.log(`Rows            ${rows.length} total, ${paid.size} already paid, ${todo.length} to pay`)
console.log(`USDC to send    ${formatUnits(todoTotal, 6)} (CSV total ${formatUnits(total, 6)})`)
console.log(`USDC balance    ${formatUnits(usdcBalance, 6)}`)
console.log(`CELO (gas)      ${formatEther(celoBalance)}`)

if (!todo.length) { console.log('\nNothing left to pay.'); process.exit(0) }
if (usdcBalance < todoTotal) die(`Insufficient USDC: have ${formatUnits(usdcBalance, 6)}, need ${formatUnits(todoTotal, 6)}`)
if (noncePending !== nonceLatest) die(`Ops wallet has ${noncePending - nonceLatest} pending tx(s). Let them clear before paying out.`)

// Simulate every transfer (catches blacklisted recipients, paused token, etc.) and size gas.
const fees = await publicClient.estimateFeesPerGas()
let gasTotal = 0n
const gasPerRow = new Map<number, bigint>()
for (const r of todo) {
  try {
    await publicClient.simulateContract({ account: opsAddress, address: CELO_USDC, abi: erc20Abi, functionName: 'transfer', args: [r.to, r.amount] })
    const gas = await publicClient.estimateContractGas({ account: opsAddress, address: CELO_USDC, abi: erc20Abi, functionName: 'transfer', args: [r.to, r.amount] })
    const padded = (gas * 13n) / 10n
    gasPerRow.set(r.line, padded)
    gasTotal += padded
  } catch (e: any) {
    die(`line ${r.line}: transfer of ${formatUnits(r.amount, 6)} USDC to ${r.to} would fail: ${e.shortMessage ?? e.message}`)
  }
}
const maxGasCost = gasTotal * fees.maxFeePerGas!
console.log(`Gas (worst case) ${formatEther(maxGasCost)} CELO`)
if (celoBalance < maxGasCost) die(`Not enough CELO for gas: have ${formatEther(celoBalance)}, need up to ${formatEther(maxGasCost)}`)

if (!SEND) {
  console.log('\nDRY RUN OK — every transfer simulated successfully. Re-run with --send to broadcast.')
  process.exit(0)
}

// ---- 4. Send, one at a time -------------------------------------------------------

if (typeof account === 'string') die('unreachable: --send without a key')
const wallet = createWalletClient({ account, chain: celo, transport: http(requireEnv('CELO_RPC_URL')) })
let nonce = noncePending
let sent = 0n

for (const r of todo) {
  const request = await wallet.prepareTransactionRequest({
    to: CELO_USDC,
    data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [r.to, r.amount] }),
    nonce,
    gas: gasPerRow.get(r.line)!,
  })
  const serialized = await wallet.signTransaction(request)
  const hash = keccak256(serialized)

  // Journal BEFORE broadcasting so a crash can never lead to paying this row twice.
  const entry: JournalEntry = { line: r.line, to: r.to, amount: r.amount.toString(), hash, nonce }
  appendFileSync(journalPath, JSON.stringify(entry) + '\n')

  await publicClient.sendRawTransaction({ serializedTransaction: serialized })
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 })
  if (receipt.status !== 'success') die(`line ${r.line}: tx ${hash} reverted. Stopping; ${formatUnits(sent, 6)} USDC sent so far this run.`)

  sent += r.amount
  nonce++
  console.log(`paid line ${r.line}  ${r.to}  ${formatUnits(r.amount, 6).padStart(14)} USDC  ${hash}`)
}

const after = await publicClient.readContract({ address: CELO_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [opsAddress] })
console.log(`\nDone. Sent ${formatUnits(sent, 6)} USDC in ${todo.length} transfers. USDC balance ${formatUnits(usdcBalance, 6)} -> ${formatUnits(after, 6)}.`)
console.log(`Journal: ${journalPath}`)
