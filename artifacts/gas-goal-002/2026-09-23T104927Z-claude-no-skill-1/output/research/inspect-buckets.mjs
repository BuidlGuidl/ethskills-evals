import { client, rpc } from './rpc.mjs'
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
const BAL = [{name:'balanceOf',type:'function',stateMutability:'view',inputs:[{type:'address'}],outputs:[{type:'uint256'}]}]
const head = await rpc(() => client.getBlockNumber())
const byBucket = {}
for (let i = 0; i < 8; i++) {
  const blk = await rpc(() => client.getBlock({ blockNumber: head - BigInt(i), includeTransactions: true }))
  for (const tx of blk.transactions) {
    if ((tx.to||'').toLowerCase() !== USDC) continue
    if (!tx.input.startsWith('0xa9059cbb') || tx.input.length !== 2+8+128) continue
    const r = await rpc(() => client.getTransactionReceipt({ hash: tx.hash }))
    if (r.status !== 'success') continue
    const b = Number(r.gasUsed)
    byBucket[b] ??= []
    if (byBucket[b].length < 2) byBucket[b].push(tx)
  }
}
for (const b of Object.keys(byBucket).sort((a,c)=>a-c)) {
  for (const tx of byBucket[b]) {
    const to = '0x' + tx.input.slice(34, 74)
    const amt = BigInt('0x' + tx.input.slice(74))
    const at = { blockNumber: tx.blockNumber - 1n }
    const bal = await rpc(() => client.readContract({ address: USDC, abi: BAL, functionName:'balanceOf', args:[to], ...at }))
    const sbal = await rpc(() => client.readContract({ address: USDC, abi: BAL, functionName:'balanceOf', args:[tx.from], ...at }))
    console.log(`gas=${b} type=${tx.type} accessList=${tx.accessList?tx.accessList.length:'-'} recipBalBefore=${bal} senderBalBefore=${sbal} amt=${amt} drainsSender=${sbal===amt}`)
  }
}
