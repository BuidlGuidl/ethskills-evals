#!/usr/bin/env node
/**
 * Measure what the relayer ACTUALLY spends on gas.
 *
 * The savings in PLAN.md assume your relayer pays roughly the ambient priority fee
 * seen on Base. That is an assumption. This script replaces it with your real number.
 *
 * Strategy: pull ERC-20 Transfer logs where `from` is the relayer (an indexed topic,
 * so this is one getLogs per range), dedupe to transactions, then read each receipt
 * for gasUsed / effectiveGasPrice / l1Fee.
 *
 * Usage:
 *   BASE_RPC_URL=... node tools/analyze-relayer.mjs 0xYourRelayer [--blocks 20000] [--token 0x...]
 */
import { createPublicClient, http, parseAbiItem, formatEther } from 'viem'
import { base } from 'viem/chains'

const RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
const MIN_MS = Number(process.env.RPC_MIN_MS || 120)
const CHUNK = Number(process.env.LOG_CHUNK || 800)

const relayer = process.argv[2]
if (!relayer?.startsWith('0x') || relayer.length !== 42) {
  console.error('usage: BASE_RPC_URL=... node tools/analyze-relayer.mjs <relayerAddress> [--blocks N] [--token 0x..]')
  process.exit(1)
}
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1] }
const blocksBack = Number(arg('blocks', 20000))
const token = arg('token', undefined)

const client = createPublicClient({ chain: base, transport: http(RPC, { retryCount: 8, retryDelay: 800 }) })
let last = 0
const throttle = async () => {
  const w = last + MIN_MS - Date.now()
  if (w > 0) await new Promise(r => setTimeout(r, w))
  last = Date.now()
}
const rpc = async fn => { await throttle(); return fn() }

const TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')

const head = await rpc(() => client.getBlockNumber())
const from = head - BigInt(blocksBack)
process.stderr.write(`scanning blocks ${from}..${head} for Transfer(from=${relayer})\n`)

/* ------------------------------------------------- collect transfer logs */

const txHashes = new Map() // hash -> transfer count
let logCount = 0
let chunk = BigInt(CHUNK)

// Providers cap getLogs ranges (and result counts) at wildly different limits,
// so shrink on rejection rather than hard-coding any one provider's ceiling.
async function logsIn(a, b) {
  try {
    return await rpc(() => client.getLogs({
      address: token, event: TRANSFER, args: { from: relayer }, fromBlock: a, toBlock: b,
    }))
  } catch (e) {
    const msg = String(e?.details || e?.message || '')
    const rangeIssue = /range|limit|too many|exceed|10000|block range/i.test(msg)
    if (!rangeIssue || b <= a) throw e
    const mid = a + (b - a) / 2n
    chunk = chunk > 100n ? chunk / 2n : 100n
    process.stderr.write(`\n  range rejected, splitting (chunk now ${chunk})\n`)
    return [...(await logsIn(a, mid)), ...(await logsIn(mid + 1n, b))]
  }
}

for (let b = from; b <= head; ) {
  const to = b + chunk - 1n > head ? head : b + chunk - 1n
  const logs = await logsIn(b, to)
  logCount += logs.length
  for (const l of logs) txHashes.set(l.transactionHash, (txHashes.get(l.transactionHash) || 0) + 1)
  process.stderr.write(`\r  ${to - from}/${head - from} blocks, ${logCount} transfers, ${txHashes.size} txs   `)
  b = to + 1n
}
process.stderr.write('\n')

if (txHashes.size === 0) {
  console.log('No outbound ERC-20 transfers found for that address in this window.')
  process.exit(0)
}

/* ------------------------------------------------------- read receipts */

let totalL2 = 0n, totalL1 = 0n, totalGas = 0n, totalTip = 0n
let nTx = 0, nTransfers = 0, newPayee = 0, classifiable = 0, skipped = 0
const tips = [], perTxTransfers = []

// Many transactions share a block, and we only need its base fee. Without this
// cache a busy relayer costs one redundant getBlock per transaction.
const blockCache = new Map()
async function baseFeeAt(blockNumber) {
  const k = blockNumber.toString()
  if (!blockCache.has(k)) {
    const blk = await rpc(() => client.getBlock({ blockNumber }))
    blockCache.set(k, blk.baseFeePerGas)
  }
  return blockCache.get(k)
}

for (const [hash, count] of txHashes) {
  let r, baseFeePerGas
  try {
    r = await rpc(() => client.getTransactionReceipt({ hash }))
    baseFeePerGas = await baseFeeAt(r.blockNumber)
  } catch (e) {
    // A partial sample still gives a usable mean; losing the whole run to one
    // rate-limited call does not.
    skipped++
    continue
  }
  if (r.status !== 'success') continue
  const blk = { baseFeePerGas }
  const gas = BigInt(r.gasUsed)
  const price = BigInt(r.effectiveGasPrice)
  const tip = price - blk.baseFeePerGas
  totalL2 += gas * price
  totalL1 += r.l1Fee ? BigInt(r.l1Fee) : 0n
  totalGas += gas
  totalTip += (tip > 0n ? tip : 0n) * gas
  tips.push(tip > 0n ? tip : 0n)
  nTx++
  nTransfers += count
  perTxTransfers.push(count)

  // Single-transfer txs can be classified by gas: ~62.2k means the payee balance
  // went 0 -> non-zero (a new payee), ~45.1k means it already held the token.
  if (count === 1) {
    classifiable++
    if (Number(gas) > 53000) newPayee++
  }
  if (nTx % 25 === 0) process.stderr.write(`\r  receipts ${nTx}/${txHashes.size}`)
}
process.stderr.write('\n')

/* ------------------------------------------------------------- report */

const total = totalL2 + totalL1
const med = a => { const s = [...a].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)); return s[Math.floor(s.length / 2)] }
const perDay = Number(arg('per-day', 40000))
const ethUsd = Number(arg('eth-usd', 2737.43))

const perTransferWei = Number(total) / nTransfers
const annualEth = (perTransferWei * perDay * 365) / 1e18

console.log(`\nRelayer gas spend — ${relayer}`)
console.log(`  window               blocks ${from}..${head} (${blocksBack.toLocaleString()} blocks, ~${(blocksBack * 2 / 3600).toFixed(1)}h)`)
console.log(`  transactions         ${nTx.toLocaleString()}${skipped ? `  (${skipped} skipped: RPC errors)` : ''}`)
console.log(`  ERC-20 transfers     ${nTransfers.toLocaleString()}  (${(nTransfers / nTx).toFixed(2)} per tx)`)
console.log(`  batched already      ${perTxTransfers.filter(c => c > 1).length} txs carried more than one transfer`)
console.log(`\n  total spent          ${formatEther(total)} ETH  ($${(Number(total) / 1e18 * ethUsd).toFixed(2)})`)
console.log(`    L2 execution       ${formatEther(totalL2)} ETH  (${(Number(totalL2 * 1000n / total) / 10).toFixed(1)}%)`)
console.log(`    L1 data            ${formatEther(totalL1)} ETH  (${(Number(totalL1 * 1000n / total) / 10).toFixed(1)}%)`)
console.log(`    of which is TIP    ${formatEther(totalTip)} ETH  (${(Number(totalTip * 1000n / total) / 10).toFixed(1)}% of all spend)`)
console.log(`\n  mean gas / transfer  ${(Number(totalGas) / nTransfers).toFixed(0)}`)
console.log(`  median priority fee  ${(Number(med(tips)) / 1e6).toFixed(3)} mwei`)
console.log(`  zero-tip txs         ${tips.filter(t => t === 0n).length}/${tips.length}`)
if (classifiable > 0) {
  console.log(`  new-payee share      ${(newPayee / classifiable * 100).toFixed(1)}%  (from ${classifiable} single-transfer txs)`)
  console.log(`                       ^ feed this to: node tools/model.mjs --new-payee-share ${(newPayee / classifiable).toFixed(2)}`)
}
console.log(`\n  extrapolated to ${perDay.toLocaleString()} transfers/day:`)
console.log(`    ${(perTransferWei / 1e18 * ethUsd).toFixed(6)} USD/transfer -> ${annualEth.toFixed(3)} ETH/yr ($${(annualEth * ethUsd).toLocaleString('en-US', { maximumFractionDigits: 0 })}/yr)`)
console.log(`\n  If the tip were dropped to the node-suggested 1 mwei, the tip component`)
console.log(`  above collapses to roughly ${(Number(totalGas) * 1e6 / 1e18 * ethUsd).toFixed(2)} USD over this window.`)
console.log()
