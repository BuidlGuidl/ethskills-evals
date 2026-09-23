import { client, rpc } from './rpc.mjs'
const USDC='0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
const head = await rpc(()=>client.getBlockNumber())
const c = {}
for (let i=0;i<12;i++){
  const b = await rpc(()=>client.getBlock({blockNumber: head-BigInt(i), includeTransactions:true}))
  for (const tx of b.transactions) if ((tx.to||'').toLowerCase()===USDC && tx.input.startsWith('0xa9059cbb')) c[tx.from]=(c[tx.from]||0)+1
}
console.log(Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,6))
