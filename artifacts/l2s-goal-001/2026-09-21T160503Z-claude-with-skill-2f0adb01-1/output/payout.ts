// Pay USDC on Celo to every row of a CSV, from the ops wallet.
//
//   npx tsx payout.ts payouts.csv                                  # dry run (default)
//   npx tsx payout.ts payouts.csv --execute --expect-total 1234.56 # broadcast
//
// CSV (header required, no quoting):
//   id,address,amount
//   2026-09-C3-000001,0xAbC...,25.50
//
// `id` must be globally unique across all cycles. Every id that has ever been
// paid is recorded in journal/payouts.jsonl and is never paid again, so a
// re-run after a crash, or a CSV edited mid-run, cannot double-pay anyone.

import { readFileSync } from 'node:fs'
import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  erc20Abi,
  encodeFunctionData,
  formatEther,
  formatUnits,
  http,
  keccak256,
  parseEventLogs,
  parseUnits,
} from 'viem'
import { celo } from 'viem/chains'
import {
  USDC_CELO,
  acquireLock,
  assertChainId,
  die,
  env,
  journalAppend,
  JOURNAL_DIR,
  journalRead,
  loadAccount,
  optionalEnv,
  parseAddress,
  parseFlags,
} from './common.ts'

const USDC_DECIMALS = 6
const JOURNAL = 'payouts.jsonl'

type Row = { id: string; to: Address; amount: bigint; line: number }
type JournalEntry = {
  id: string
  status: 'signed' | 'confirmed' | 'reverted'
  to: string
  amount: string
  txHash?: Hex
  nonce?: number
}

// ---------------------------------------------------------------------------
// CSV parsing: strict. Anything ambiguous is an error, not a guess.
// ---------------------------------------------------------------------------

function parseCsv(path: string, opsWallet: Address): Row[] {
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/)
  const header = lines[0]?.split(',').map((h) => h.trim().toLowerCase())
  if (header?.join(',') !== 'id,address,amount') die(`${path}: header must be exactly "id,address,amount"`)

  const maxPer = optionalEnv('PAYOUT_MAX_PER_RECIPIENT_USDC')
  const maxPerUnits = maxPer ? parseUnits(maxPer, USDC_DECIMALS) : undefined

  const rows: Row[] = []
  const ids = new Set<string>()
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i]
    if (raw.trim() === '') continue
    const line = i + 1
    if (raw.includes('"')) die(`${path}:${line}: quoted fields are not supported`)
    const cols = raw.split(',').map((c) => c.trim())
    if (cols.length !== 3) die(`${path}:${line}: expected 3 columns, got ${cols.length}`)
    const [id, addr, amt] = cols

    if (!/^[A-Za-z0-9._:-]{1,64}$/.test(id)) die(`${path}:${line}: bad id "${id}"`)
    if (ids.has(id)) die(`${path}:${line}: duplicate id "${id}"`)
    ids.add(id)

    const to = parseAddress(addr, `${path}:${line}`)
    if (to === opsWallet) die(`${path}:${line}: recipient is the ops wallet itself`)
    if (to.toLowerCase() === USDC_CELO.toLowerCase()) die(`${path}:${line}: recipient is the USDC contract`)

    // Decimal string with at most 6 places. No sci-notation, no floats.
    if (!/^\d+(\.\d{1,6})?$/.test(amt)) die(`${path}:${line}: bad amount "${amt}" (max 6 decimals, no symbols)`)
    const amount = parseUnits(amt, USDC_DECIMALS)
    if (amount === 0n) die(`${path}:${line}: amount is zero`)
    if (maxPerUnits !== undefined && amount > maxPerUnits)
      die(`${path}:${line}: ${amt} exceeds PAYOUT_MAX_PER_RECIPIENT_USDC=${maxPer}`)

    rows.push({ id, to, amount, line })
  }
  if (rows.length === 0) die(`${path}: no rows`)
  return rows
}

// ---------------------------------------------------------------------------

async function main() {
  const { positional, flags } = parseFlags(process.argv.slice(2))
  const csvPath = positional[0] ?? die('usage: payout.ts <file.csv> [--execute --expect-total <USDC>] [--allow-contract-recipients]')
  const execute = flags.has('execute')

  const account = loadAccount('OPS_PRIVATE_KEY')
  const transport = http(env('CELO_RPC_URL'), { retryCount: 3, timeout: 30_000 })
  const publicClient = createPublicClient({ chain: celo, transport })
  const walletClient = createWalletClient({ chain: celo, transport, account })
  await assertChainId(publicClient, celo.id, 'CELO_RPC_URL')

  if (execute) acquireLock('payout.ts')

  // Sanity-check the token contract actually is 6-decimal USDC.
  const [symbol, decimals] = await Promise.all([
    publicClient.readContract({ address: USDC_CELO, abi: erc20Abi, functionName: 'symbol' }),
    publicClient.readContract({ address: USDC_CELO, abi: erc20Abi, functionName: 'decimals' }),
  ])
  if (symbol !== 'USDC' || decimals !== USDC_DECIMALS) die(`USDC contract returned ${symbol}/${decimals}; refusing`)

  const rows = parseCsv(csvPath, account.address)
  const csvTotal = rows.reduce((s, r) => s + r.amount, 0n)

  // ---- Reconcile with the journal -----------------------------------------
  const journal = journalRead<JournalEntry>(JOURNAL)
  const latest = new Map<string, JournalEntry>()
  for (const e of journal) latest.set(e.id, e)

  for (const r of rows) {
    const prev = latest.get(r.id)
    if (prev && (prev.to.toLowerCase() !== r.to.toLowerCase() || BigInt(prev.amount) !== r.amount))
      die(`id ${r.id} was previously journaled for ${prev.to} / ${formatUnits(BigInt(prev.amount), 6)} USDC ` +
        `but the CSV now says ${r.to} / ${formatUnits(r.amount, 6)}. Ids must never be reused.`)
  }

  // A "signed" entry with no outcome means a previous run died around broadcast.
  // Resolve it on-chain before doing anything else.
  for (const [id, e] of latest) {
    if (e.status !== 'signed') continue
    const receipt = await publicClient.getTransactionReceipt({ hash: e.txHash! }).catch(() => null)
    if (receipt) {
      const status = receipt.status === 'success' ? 'confirmed' : 'reverted'
      journalAppend(JOURNAL, { ...e, status })
      latest.set(id, { ...e, status })
      console.log(`recovered ${id}: ${status} (${e.txHash})`)
      continue
    }
    const minedNonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'latest' })
    die(`id ${id} was signed as ${e.txHash} (nonce ${e.nonce}) but has no receipt. ` +
      (minedNonce > (e.nonce ?? 0)
        ? 'That nonce has been used by a different tx, so it was dropped or replaced. Check the explorer, then append a "reverted" entry for this id to the journal if it was not paid.'
        : 'It may still be pending. Wait and re-run, or broadcast the same tx again. Do NOT remove the journal entry.'))
  }

  const pending = rows.filter((r) => latest.get(r.id)?.status !== 'confirmed')
  const pendingTotal = pending.reduce((s, r) => s + r.amount, 0n)

  // ---- Pre-flight -----------------------------------------------------------
  const [usdcBal, celoBal, nonceLatest, noncePending, fees] = await Promise.all([
    publicClient.readContract({ address: USDC_CELO, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
    publicClient.getBalance({ address: account.address }),
    publicClient.getTransactionCount({ address: account.address, blockTag: 'latest' }),
    publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' }),
    publicClient.estimateFeesPerGas(),
  ])

  // Warn about recipients that are contracts: a mistyped token/contract address loses funds.
  const contractRecipients: Row[] = []
  for (const r of pending) {
    const code = await publicClient.getCode({ address: r.to })
    if (code && code !== '0x') contractRecipients.push(r)
  }

  // Duplicate recipients are legal (two separate payouts) but worth a look.
  const byAddr = new Map<string, string[]>()
  for (const r of rows) byAddr.set(r.to, [...(byAddr.get(r.to) ?? []), r.id])
  const dupes = [...byAddr].filter(([, ids]) => ids.length > 1)

  const gasPerTransfer = 80_000n // observed ~40-60k; padded
  const gasBudget = gasPerTransfer * BigInt(pending.length) * fees.maxFeePerGas!

  console.log(`
Ops wallet        ${account.address}
Token             USDC ${USDC_CELO} (Celo, chain ${celo.id})
CSV               ${csvPath}: ${rows.length} rows, total ${formatUnits(csvTotal, 6)} USDC
Already paid      ${rows.length - pending.length} rows (per journal)
To pay now        ${pending.length} rows, ${formatUnits(pendingTotal, 6)} USDC
USDC balance      ${formatUnits(usdcBal, 6)}
CELO balance      ${formatEther(celoBal)} (gas budget ~${formatEther(gasBudget)})
Nonce             latest=${nonceLatest} pending=${noncePending}`)
  if (dupes.length) console.log(`\nNOTE: repeated recipients:\n${dupes.map(([a, ids]) => `  ${a}: ${ids.join(', ')}`).join('\n')}`)
  if (contractRecipients.length)
    console.log(`\nWARNING: these recipients are contracts:\n${contractRecipients.map((r) => `  ${r.id} ${r.to}`).join('\n')}`)

  const problems: string[] = []
  if (usdcBal < pendingTotal) problems.push(`USDC short by ${formatUnits(pendingTotal - usdcBal, 6)}`)
  if (celoBal < gasBudget) problems.push(`CELO for gas short: have ${formatEther(celoBal)}, want ${formatEther(gasBudget)}`)
  if (noncePending !== nonceLatest) problems.push('ops wallet has pending transactions in the mempool; let them clear first')
  if (contractRecipients.length && !flags.has('allow-contract-recipients'))
    problems.push('contract recipients present; pass --allow-contract-recipients if they are intended (e.g. Safe wallets)')

  // Simulate every transfer: catches blacklisted (Circle-frozen) senders/recipients before anything is sent.
  for (const r of pending) {
    try {
      await publicClient.simulateContract({ account, address: USDC_CELO, abi: erc20Abi, functionName: 'transfer', args: [r.to, r.amount] })
    } catch (e: any) {
      if (usdcBal >= pendingTotal) problems.push(`${r.id} (${r.to}) would revert: ${e.shortMessage ?? e.message}`)
    }
  }

  if (problems.length) die(`pre-flight failed:\n  - ${problems.join('\n  - ')}`)
  if (pending.length === 0) { console.log('\nNothing to do: every row is already paid.'); return }

  if (!execute) {
    console.log('\nDRY RUN: nothing sent. Re-run with --execute --expect-total <CSV total> to pay.')
    return
  }

  // Four-eyes control: the operator types the finance-approved total; it must match the CSV exactly.
  const expect = flags.get('expect-total')
  if (typeof expect !== 'string' || !/^\d+(\.\d{1,6})?$/.test(expect)) die('--execute requires --expect-total <USDC total of the CSV>')
  if (parseUnits(expect, USDC_DECIMALS) !== csvTotal)
    die(`--expect-total ${expect} does not match CSV total ${formatUnits(csvTotal, 6)}`)

  // ---- Send, strictly one at a time ----------------------------------------
  let nonce = nonceLatest
  let paid = 0n
  for (const r of pending) {
    const request = await walletClient.prepareTransactionRequest({
      to: USDC_CELO,
      data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [r.to, r.amount] }),
      nonce,
    })
    const serialized = await walletClient.signTransaction(request)
    const txHash = keccak256(serialized)

    // Journal first: if we crash after broadcast, the next run finds this and reconciles.
    journalAppend(JOURNAL, { id: r.id, status: 'signed', to: r.to, amount: r.amount, txHash, nonce })
    await walletClient.sendRawTransaction({ serializedTransaction: serialized })

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 180_000 })
    if (receipt.status !== 'success') {
      journalAppend(JOURNAL, { id: r.id, status: 'reverted', to: r.to, amount: r.amount, txHash, nonce })
      die(`${r.id} reverted in ${txHash}. Stopping. Paid so far this run: ${formatUnits(paid, 6)} USDC`)
    }

    // Verify the exact Transfer we intended actually happened.
    const ok = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: receipt.logs }).some(
      (l) => l.address.toLowerCase() === USDC_CELO.toLowerCase() &&
        l.args.from === account.address && l.args.to === r.to && l.args.value === r.amount,
    )
    if (!ok) die(`${r.id}: tx ${txHash} succeeded but no matching USDC Transfer log. Investigate before continuing.`)

    journalAppend(JOURNAL, { id: r.id, status: 'confirmed', to: r.to, amount: r.amount, txHash, nonce })
    paid += r.amount
    nonce++
    console.log(`paid ${r.id} ${formatUnits(r.amount, 6)} USDC -> ${r.to}  ${celo.blockExplorers.default.url}/tx/${txHash}`)
  }

  console.log(`\nDone. Paid ${pending.length} rows, ${formatUnits(paid, 6)} USDC. Journal: ${JOURNAL_DIR}/${JOURNAL}`)
}

main().catch((e) => die(e?.shortMessage ?? e?.message ?? String(e)))
