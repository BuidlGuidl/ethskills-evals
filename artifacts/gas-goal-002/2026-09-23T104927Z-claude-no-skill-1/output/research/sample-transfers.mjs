import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

const client = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') })
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
const SEL_TRANSFER = '0xa9059cbb'

const head = await client.getBlockNumber()
const samples = []
let scanned = 0

for (let i = 0; i < 40 && samples.length < 120; i++) {
  const bn = head - BigInt(i)
  const blk = await client.getBlock({ blockNumber: bn, includeTransactions: true })
  scanned++
  for (const tx of blk.transactions) {
    if ((tx.to || '').toLowerCase() !== USDC) continue
    if (!tx.input.startsWith(SEL_TRANSFER)) continue
    if (tx.input.length !== 2 + 8 + 64 * 2) continue // exactly transfer(address,uint256)
    const r = await client.getTransactionReceipt({ hash: tx.hash })
    if (r.status !== 'success') continue
    samples.push({
      hash: tx.hash,
      gasUsed: Number(r.gasUsed),
      l1Fee: r.l1Fee ? BigInt(r.l1Fee) : 0n,
      effGasPrice: BigInt(r.effectiveGasPrice),
      inputBytes: (tx.input.length - 2) / 2,
      type: tx.type,
    })
    if (samples.length >= 120) break
  }
}

const gas = samples.map(s => s.gasUsed).sort((a, b) => a - b)
const pct = p => gas[Math.floor((gas.length - 1) * p)]
const mean = a => a.reduce((x, y) => x + y, 0) / a.length

// histogram of gasUsed buckets
const buckets = {}
for (const g of gas) { const b = Math.round(g / 1000) * 1000; buckets[b] = (buckets[b] || 0) + 1 }

console.log('head block', head, 'blocks scanned', scanned, 'samples', samples.length)
console.log('gasUsed  min', gas[0], 'p25', pct(.25), 'p50', pct(.5), 'p75', pct(.75), 'p90', pct(.9), 'max', gas[gas.length-1], 'mean', mean(gas).toFixed(0))
console.log('gasUsed histogram (1k buckets):')
for (const k of Object.keys(buckets).sort((a,b)=>a-b)) console.log('   ', k, '=>', buckets[k])

const l1 = samples.map(s => s.l1Fee)
const l2 = samples.map(s => BigInt(s.gasUsed) * s.effGasPrice)
const sum = a => a.reduce((x, y) => x + y, 0n)
console.log('mean L1 fee wei', (sum(l1) / BigInt(l1.length)).toString())
console.log('mean L2 fee wei', (sum(l2) / BigInt(l2.length)).toString())
console.log('mean effGasPrice wei', (sum(samples.map(s=>s.effGasPrice)) / BigInt(samples.length)).toString())
console.log('L1 share of total', Number(sum(l1) * 10000n / (sum(l1) + sum(l2))) / 100, '%')
console.log('mean input bytes', mean(samples.map(s => s.inputBytes)))
console.log('tx types', JSON.stringify(samples.reduce((a,s)=>(a[s.type]=(a[s.type]||0)+1,a),{})))
