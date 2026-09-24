import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'
const client = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') })

const head = await client.getBlockNumber()
const N = 60
const rows = []
for (let i = 0; i < N; i++) {
  const blk = await client.getBlock({ blockNumber: head - BigInt(i), includeTransactions: true })
  const bf = blk.baseFeePerGas
  const tips = []
  for (const tx of blk.transactions) {
    let tip
    if (tx.type === 'eip1559' || tx.type === 'eip4844' || tx.type === 'eip7702') {
      const cap = BigInt(tx.maxFeePerGas), pri = BigInt(tx.maxPriorityFeePerGas)
      tip = cap - bf < pri ? cap - bf : pri
    } else { tip = BigInt(tx.gasPrice) - bf }
    if (tip < 0n) tip = 0n
    tips.push(tip)
  }
  tips.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  rows.push({ bn: blk.number, bf, gasUsed: blk.gasUsed, gasLimit: blk.gasLimit, n: tips.length,
    minTip: tips[0] ?? 0n, p10: tips[Math.floor(tips.length*0.1)] ?? 0n, p50: tips[Math.floor(tips.length*0.5)] ?? 0n })
}

const med = a => { const s=[...a].sort((x,y)=>(x<y?-1:x>y?1:0)); return s[Math.floor(s.length/2)] }
console.log('blocks', N, 'head', head)
console.log('baseFee  min', rows.reduce((m,r)=>r.bf<m?r.bf:m,rows[0].bf).toString(),
            'median', med(rows.map(r=>r.bf)).toString(),
            'max', rows.reduce((m,r)=>r.bf>m?r.bf:m,rows[0].bf).toString(), 'wei')
console.log('block fullness: median', (Number(med(rows.map(r=>r.gasUsed*10000n/r.gasLimit)))/100).toFixed(2), '%',
            ' max', (Number(rows.reduce((m,r)=>{const u=r.gasUsed*10000n/r.gasLimit; return u>m?u:m},0n))/100).toFixed(2), '%')
console.log('gasLimit', rows[0].gasLimit.toString())
console.log('per-block MIN included tip: median', med(rows.map(r=>r.minTip)).toString(), 'wei')
console.log('per-block p10 tip: median', med(rows.map(r=>r.p10)).toString(), 'wei')
console.log('per-block p50 tip: median', med(rows.map(r=>r.p50)).toString(), 'wei')
const zero = rows.filter(r => r.minTip === 0n).length
console.log('blocks containing a ZERO-tip tx:', zero, '/', N)
console.log('\nsample rows:')
for (const r of rows.slice(0,8)) console.log('  bn',r.bn.toString(),'bf',r.bf.toString(),'txs',r.n,'full',(Number(r.gasUsed*10000n/r.gasLimit)/100).toFixed(1)+'%','minTip',r.minTip.toString(),'p50tip',r.p50.toString())

// what does the node's own fee oracle suggest?
const hist = await client.getFeeHistory({ blockCount: 50, rewardPercentiles: [5, 25, 50, 90] })
const cols = [0,1,2,3].map(c => med(hist.reward.map(r => r[c])))
console.log('\nfeeHistory reward percentiles (median over 50 blocks): p5', cols[0].toString(), 'p25', cols[1].toString(), 'p50', cols[2].toString(), 'p90', cols[3].toString())
